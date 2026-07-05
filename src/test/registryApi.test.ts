import { describe, it, expect, vi, afterEach } from "vitest";
import { registryApi } from "@/lib/api";

describe("registryApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls GET /registry against the configured API base and returns parsed groups", async () => {
    const mockGroups = [{ id: "overview", labelKey: "sidebar.overview", items: [] }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ groups: mockGroups }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await registryApi.get();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/registry$/);
    expect(result.groups).toEqual(mockGroups);
  });
});
