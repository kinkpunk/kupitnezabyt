import { getPersonalWorkspaceId } from "@kupitnezabyt/database";
import type { Prisma } from "@kupitnezabyt/database";
import { getShoppingSyncAction, isItemStatus } from "@kupitnezabyt/shared";

import { upsertItemCheckReminder } from "../services.js";

export async function syncRestoredItem(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    userId: string;
    workspaceId?: string | null;
    categoryId: string;
    name: string;
    status: string;
    nextCheckAt: Date | null;
  }
): Promise<void> {
  if (!isItemStatus(item.status)) {
    return;
  }

  const action = getShoppingSyncAction(item.status);

  if (action.type === "UPSERT") {
    const openShoppingListItem = await tx.shoppingListItem.findFirst({
      where: {
        workspaceId: item.workspaceId ?? getPersonalWorkspaceId(item.userId),
        itemId: item.id,
        isCompleted: false
      }
    });

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
    } else {
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
    }
  }

  if (item.nextCheckAt) {
    await upsertItemCheckReminder(tx, {
      userId: item.userId,
      workspaceId: item.workspaceId ?? getPersonalWorkspaceId(item.userId),
      itemId: item.id,
      scheduledFor: item.nextCheckAt
    });
  }
}
