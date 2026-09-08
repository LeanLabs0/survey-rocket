import type { APIRoute } from "astro";
import { jsonOk, listUsersWithClients } from "../../../lib/access";

export const GET: APIRoute = async () => {
  const users = await listUsersWithClients();
  return jsonOk({ users });
};
