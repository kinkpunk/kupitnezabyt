import {
  calculateNextCheckAt,
  createReminderIdempotencyKey,
  getShoppingSyncAction
} from "@kupitnezabyt/shared";
import type { ItemStatus } from "@kupitnezabyt/shared";
import type { Item, Prisma, ShoppingListItem } from "@prisma/client";

import { getPersonalWorkspaceId } from "./workspaces.js";

type TransactionClient = Prisma.TransactionClient;

export async function setItemStatus(
  tx: TransactionClient,
  userId: string,
  itemId: string,
  status: ItemStatus,
  now = new Date()
): Promise<Item> {
  const item = await tx.item.findFirst({
    where: {
      id: itemId,
      userId,
      archivedAt: null
    }
  });

  if (!item) {
    throw new Error("ITEM_NOT_FOUND");
  }

  const updatedItem = await tx.item.update({
    where: {
      id: item.id
    },
    data: {
      status,
      lastCheckedAt: now,
      nextCheckAt: calculateNextCheckAt(status, now, item.usageCycleDays)
    }
  });

  await syncShoppingListItem(tx, updatedItem, now);
  return updatedItem;
}

export async function markShoppingListItemBought(
  tx: TransactionClient,
  userId: string,
  shoppingListItemId: string,
  now = new Date()
): Promise<ShoppingListItem> {
  const shoppingListItem = await tx.shoppingListItem.findFirst({
    where: {
      id: shoppingListItemId,
      userId,
      isCompleted: false
    }
  });

  if (!shoppingListItem) {
    throw new Error("SHOPPING_LIST_ITEM_NOT_FOUND");
  }

  if (shoppingListItem.itemId) {
    const item = await tx.item.findFirst({
      where: {
        id: shoppingListItem.itemId,
        userId,
        archivedAt: null
      }
    });

    if (item) {
      await tx.item.update({
        where: {
          id: item.id
        },
        data: {
          status: "IN_STOCK",
          lastBoughtAt: now,
          lastCheckedAt: now,
          nextCheckAt: calculateNextCheckAt("IN_STOCK", now, item.usageCycleDays)
        }
      });
    }
  }

  return tx.shoppingListItem.update({
    where: {
      id: shoppingListItem.id
    },
    data: {
      isCompleted: true,
      completedAt: now
    }
  });
}

export async function upsertItemCheckReminder(
  tx: TransactionClient,
  input: {
    userId: string;
    itemId: string;
    scheduledFor: Date;
  }
): Promise<void> {
  const idempotencyKey = createReminderIdempotencyKey({
    userId: input.userId,
    type: "ITEM_CHECK",
    itemId: input.itemId,
    scheduledFor: input.scheduledFor
  });

  await tx.reminder.upsert({
    where: {
      idempotencyKey
    },
    update: {
      scheduledFor: input.scheduledFor,
      status: "PENDING",
      attemptCount: 0,
      sentAt: null
    },
    create: {
      userId: input.userId,
      workspaceId: getPersonalWorkspaceId(input.userId),
      type: "ITEM_CHECK",
      itemId: input.itemId,
      scheduledFor: input.scheduledFor,
      idempotencyKey
    }
  });
}

export async function cancelPendingItemCheckReminders(
  tx: TransactionClient,
  userId: string,
  itemId: string
): Promise<void> {
  await tx.reminder.updateMany({
    where: {
      userId,
      itemId,
      type: "ITEM_CHECK",
      status: "PENDING"
    },
    data: {
      status: "CANCELLED"
    }
  });
}

async function syncShoppingListItem(
  tx: TransactionClient,
  item: Item,
  now: Date
): Promise<void> {
  const action = getShoppingSyncAction(item.status);
  const openShoppingListItem = await tx.shoppingListItem.findFirst({
    where: {
      userId: item.userId,
      itemId: item.id,
      isCompleted: false
    }
  });

  if (action.type === "UPSERT") {
    await cancelPendingItemCheckReminders(tx, item.userId, item.id);

    if (openShoppingListItem) {
      await tx.shoppingListItem.update({
        where: {
          id: openShoppingListItem.id
        },
        data: {
          title: item.name,
          categoryId: item.categoryId,
          priority: action.priority
        }
      });
      return;
    }

    await tx.shoppingListItem.create({
      data: {
        userId: item.userId,
        workspaceId: item.workspaceId ?? getPersonalWorkspaceId(item.userId),
        itemId: item.id,
        title: item.name,
        categoryId: item.categoryId,
        priority: action.priority
      }
    });
    return;
  }

  if (action.type === "COMPLETE_OPEN" && openShoppingListItem) {
    await tx.shoppingListItem.update({
      where: {
        id: openShoppingListItem.id
      },
      data: {
        isCompleted: true,
        completedAt: now
      }
    });
  }

  if (item.nextCheckAt) {
    await upsertItemCheckReminder(tx, {
      userId: item.userId,
      itemId: item.id,
      scheduledFor: item.nextCheckAt
    });
  } else {
    await cancelPendingItemCheckReminders(tx, item.userId, item.id);
  }
}
