// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CompanySecret, ToolApplication, ToolConnection } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../context/ToastContext";
import { ApplicationsTab } from "./ApplicationsTab";

const mockToolsApi = vi.hoisted(() => ({
  listConnections: vi.fn(),
  listApplications: vi.fn(),
  listCatalog: vi.fn(),
  listStdioTemplates: vi.fn(),
  checkConnectionHealth: vi.fn(),
  refreshCatalog: vi.fn(),
  createConnection: vi.fn(),
  updateConnection: vi.fn(),
}));

const mockSecretsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("../../api/tools", () => ({ toolsApi: mockToolsApi }));
vi.mock("../../api/secrets", () => ({ secretsApi: mockSecretsApi }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!globalThis.PointerEvent) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = MouseEvent;
}

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function makeConnection(overrides: Partial<ToolConnection>): ToolConnection {
  return {
    id: "conn-1",
    companyId: "company-1",
    applicationId: "app-1",
    name: "Production GitHub",
    connectionKind: "managed",
    transport: "remote_http",
    status: "active",
    transportConfig: { url: "https://mcp.github.example.com" },
    config: {},
    credentialSecretRefs: [],
    credentialRefs: [{ name: "Authorization", secretId: "secret-1", version: "latest", placement: "header", key: "Authorization" }],
    healthStatus: "healthy",
    healthMessage: null,
    healthCheckedAt: new Date("2026-06-10T00:00:00Z"),
    lastCatalogRefreshAt: new Date("2026-06-10T00:00:00Z"),
    lastError: null,
    enabled: true,
    createdByAgentId: null,
    createdByUserId: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-10T00:00:00Z"),
    ...overrides,
  };
}

function makeApp(overrides: Partial<ToolApplication>): ToolApplication {
  return {
    id: "app-1",
    companyId: "company-1",
    name: "GitHub",
    description: "Issue triage MCP",
    type: "mcp_http",
    status: "active",
    pluginId: null,
    ownerAgentId: null,
    ownerUserId: null,
    metadata: null,
    archivedAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

function makeSecret(overrides: Partial<CompanySecret>): CompanySecret {
  return {
    id: "secret-1",
    companyId: "company-1",
    key: "github_token",
    name: "GitHub token",
    provider: "local_encrypted",
    status: "active",
    managedMode: "paperclip_managed",
    externalRef: null,
    providerConfigId: null,
    providerMetadata: null,
    latestVersion: 3,
    description: null,
    lastResolvedAt: null,
    lastRotatedAt: null,
    deletedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

describe("ApplicationsTab", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockToolsApi.listApplications.mockResolvedValue({
      applications: [makeApp({}), makeApp({ id: "app-2", name: "Linear", description: null })],
    });
    mockToolsApi.listConnections.mockResolvedValue({ connections: [makeConnection({})] });
    mockToolsApi.listCatalog.mockResolvedValue({
      catalog: [
        { id: "c1", toolName: "create_issue" },
        { id: "c2", toolName: "list_repos" },
      ],
    });
    mockToolsApi.listStdioTemplates.mockResolvedValue({ templates: [] });
    mockSecretsApi.list.mockResolvedValue([makeSecret({})]);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  async function render() {
    await act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ApplicationsTab companyId="company-1" />
          </ToastProvider>
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();
  }

  it("renders applications as top-level rows and expands to connection actions", async () => {
    await render();

    const text = container.textContent ?? "";
    expect(text).toContain("Applications");
    expect(text).toContain("GitHub");
    expect(text).toContain("MCP HTTP");

    const expand = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Expand GitHub",
    );
    expect(expand).toBeTruthy();
    await act(() => {
      expand!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    const expandedText = container.textContent ?? "";
    expect(expandedText).toContain("Production GitHub");
    expect(expandedText).toContain("https://mcp.github.example.com");
    expect(expandedText).toContain("remote http");
    expect(expandedText).toContain("Probe");
    expect(expandedText).toContain("Refresh");
    expect(expandedText).toContain("Catalog");
    expect(expandedText).toContain("Disable");
  });

  it("opens the unified add wizard from an application row", async () => {
    await render();

    const expand = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Expand Linear",
    );
    await act(() => {
      expand!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    const add = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Add connection"),
    );
    expect(add).toBeTruthy();
    await act(() => {
      add!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    const body = document.body.textContent ?? "";
    expect(body).toContain("Add application");
    expect(body).toContain("2 Connection");
    expect(body).toContain("Credential references");
    expect(body).toContain("Free-text secrets are not accepted");
  });
});
