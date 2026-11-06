import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganization, type CreateOrganizationState } from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const rpc = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const idle: CreateOrganizationState = { status: "idle", message: "" };

function fields(name = "College of Engineering", slug = "coecs") {
  const data = new FormData();
  data.set("name", name);
  data.set("slug", slug);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({
    status: "authenticated", email: "admin@hnu.edu.ph",
  });
  vi.mocked(createClient).mockResolvedValue({
    rpc,
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockResolvedValue({ data: true, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("createOrganization server action", () => {
  it("creates only name and slug, then refreshes the directory", async () => {
    const result = await createOrganization(idle, fields("  College of Engineering  ", "  coecs  "));
    expect(result.status).toBe("success");
    expect(result.message).toContain("College of Engineering");
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(from).toHaveBeenCalledWith("organizations");
    expect(insert).toHaveBeenCalledWith({
      name: "College of Engineering", slug: "coecs",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/organizations");
  });

  it("rejects signed-out or otherwise unverified callers without database access", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    const signedOut = await createOrganization(idle, fields());
    expect(signedOut.status).toBe("error");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    const denied = await createOrganization(idle, fields());
    expect(denied.status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects non-admins even when they have a valid HNU session", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await createOrganization(idle, fields())).toEqual({
      status: "error", message: "Only platform administrators can create organizations.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed if the Backend role check errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await createOrganization(idle, fields())).status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects invalid names and slugs before querying the Backend", async () => {
    const name = await createOrganization(idle, fields("x", "coecs"));
    const slug = await createOrganization(idle, fields("Valid organization", "Invalid Slug"));
    expect(name.fieldErrors?.name).toBeDefined();
    expect(slug.fieldErrors?.slug).toBeDefined();
    expect(createClient).not.toHaveBeenCalled();
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("reports duplicate slugs and does not claim success or refresh", async () => {
    insert.mockResolvedValue({ error: { code: "23505" } });
    const result = await createOrganization(idle, fields());
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.slug).toBe("Choose a unique slug.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not expose raw RLS/permission errors from failed writes", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "permission denied" } });
    const result = await createOrganization(idle, fields());
    expect(result.status).toBe("error");
    expect(result.message).not.toContain("permission denied");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
