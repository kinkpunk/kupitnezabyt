import { getPersonalWorkspaceId, prisma } from "@kupitnezabyt/database";
import { calculateNextCheckAt, isItemImportance } from "@kupitnezabyt/shared";
import type { ItemImportance } from "@kupitnezabyt/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { RateLimiter } from "../rate-limit.js";
import type { WorkspaceAccess } from "./types.js";

export async function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
): Promise<void> {
  await reply.code(statusCode).send({
    error: {
      code,
      message
    }
  });
}

export function requireUserId(userId: string | undefined): string {
  if (!userId) {
    throw new Error("Missing auth context");
  }

  return userId;
}

export async function resolveWorkspaceAccess(
  request: FastifyRequest,
  userId: string
): Promise<WorkspaceAccess | null> {
  const requestedWorkspaceId = readWorkspaceIdHeader(request);
  const personalWorkspaceId = getPersonalWorkspaceId(userId);

  if (!requestedWorkspaceId || requestedWorkspaceId === personalWorkspaceId) {
    return {
      role: "OWNER",
      workspaceId: personalWorkspaceId
    };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId: requestedWorkspaceId,
      joinedAt: {
        not: null
      }
    },
    select: {
      role: true,
      workspaceId: true
    }
  });

  return membership
    ? {
        role: membership.role,
        workspaceId: membership.workspaceId
      }
    : null;
}

export function canWriteWorkspace(workspaceAccess: WorkspaceAccess): boolean {
  return workspaceAccess.role === "OWNER" || workspaceAccess.role === "EDITOR";
}

export function readWorkspaceIdHeader(request: FastifyRequest): string | null {
  const header = request.headers["x-workspace-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function checkRateLimit(
  reply: FastifyReply,
  limiter: RateLimiter,
  key: string
): Promise<boolean> {
  if (limiter.consume(key)) {
    return true;
  }

  await sendError(reply, 429, "RATE_LIMITED", "Too many attempts. Please try again later.");
  return false;
}

export function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const values: string[] = [];
  for (const currentValue of value) {
    const parsedValue = readRequiredString(currentValue);
    if (!parsedValue) {
      return null;
    }

    values.push(parsedValue);
  }

  return values;
}

export function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }

  return value;
}

export function readNullableDate(value: unknown): { value: Date | null; invalid: boolean } {
  if (value === null || value === "") {
    return { value: null, invalid: false };
  }

  if (typeof value !== "string") {
    return { value: null, invalid: true };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { value: null, invalid: true };
  }

  return { value: date, invalid: false };
}

export function calculateConfiguredNextCheckAt(now: Date, usageCycleDays: number | null): Date | null {
  return usageCycleDays ? calculateNextCheckAt("IN_STOCK", now, usageCycleDays) : null;
}

export function readBooleanFlag(value: unknown): boolean {
  return value === "true" || value === "1";
}

export function readShoppingPriority(value: unknown): "NORMAL" | "URGENT" | null {
  if (value === undefined || value === null || value === "") {
    return "NORMAL";
  }

  return value === "NORMAL" || value === "URGENT" ? value : null;
}

export function readOptionalItemImportance(value: unknown): ItemImportance | null | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return typeof value === "string" && isItemImportance(value) ? value : null;
}

export function hasOwnProperty<TObject extends object, TKey extends PropertyKey>(
  value: TObject,
  key: TKey
): value is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
