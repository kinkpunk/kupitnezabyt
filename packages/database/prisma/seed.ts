import { prisma } from "../src/index.js";

await prisma.$connect();
await prisma.$disconnect();
