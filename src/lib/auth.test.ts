import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthState } from "./auth";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

vi.mock("./supabase/env", () => ({ isSupabaseConfigured: vi.fn() }));
vi.mock("./supabase/server", () => ({ createClient: vi.fn() }));

const getUser = vi.fn();
const rpc = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser }, rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  getUser.mockResolvedValue({
    data: { user: { email: "student@hnu.edu.ph" } }, error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("server authentication gate", () => {
  it("reports missing public configuration without contacting Auth", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    expect(await getAuthState()).toEqual({ status: "unconfigured" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users instead of authorizing a cached session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getAuthState()).toEqual({ status: "signed-out" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires the Backend's verified-HNU function", async () => {
    expect(await getAuthState()).toEqual({
      status: "authenticated", email: "student@hnu.edu.ph",
    });
    expect(rpc).toHaveBeenCalledWith("hnu_verified_user");
  });

  it("rejects an unverified identity even when Supabase has a user session", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await getAuthState()).toEqual({ status: "denied" });
  });

  it("fails closed when authorization cannot be checked", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect(await getAuthState()).toEqual({ status: "error" });
  });
});
