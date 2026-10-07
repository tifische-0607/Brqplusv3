import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/programs/give-network")({ component: () => <Outlet /> });