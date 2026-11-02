import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client/client";

const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: "postgresql://user:pass@localhost:5432/test" }),
});
console.log("loaded:", typeof PrismaClient, "client:", typeof (client as any).$queryRaw);
void client.$disconnect();
