// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: vi.fn() }));

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();
const signOut = vi.fn();

function request(query: string) {
  return new Request(`http://localhost:3000/auth/callback${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  vi.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession, getUser, signOut }, rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  exchangeCodeForSession.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: "test-id" } }, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
  signOut.mockResolvedValue({ error: null });
});

describe("OAuth callback", () => {
  it("exchanges a PKCE code and redirects a verified user home", async () => {
    const response = await GET(request("?code=test-code"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(rpc).toHaveBeenCalledWith("hnu_verified_user");
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects unauthorized users and signs out their session", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const response = await GET(request("?code=test-code"));
    expect(signOut).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toContain("error=access_denied");
  });

  it("never exchanges a missing or provider-rejected code", async () => {
    expect((await GET(request(""))).headers.get("location")).toContain("error=missing_code");
    expect((await GET(request("?error=access_denied"))).headers.get("location")).toContain("error=oauth_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("does not accept failed exchanges or inaccessible Backend checks", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: { message: "failed" } });
    expect((await GET(request("?code=bad"))).headers.get("location")).toContain("error=oauth_failed");
    rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    expect((await GET(request("?code=test-code"))).headers.get("location")).toContain("error=auth_unavailable");
  });
});
