import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { bindFixtureTransport } from "./fixture-transport";
import { ACTOR, EVENT, context } from "./test-fixtures";

vi.mock("@/lib/supabase/server",()=>({createClient:vi.fn()}));

describe("fixture isolation and scoped transport",()=>{
  it("ordinary app source has no successor fixture import or direct successor RPC",()=>{
    function visit(path:string):void {
      for(const entry of readdirSync(path,{withFileTypes:true})) {
        const full=join(path,entry.name);
        if(entry.isDirectory()) visit(full);
        else if(/\.(ts|tsx)$/.test(entry.name)&&!entry.name.includes(".test.")) {
          expect(readFileSync(full,"utf8"),full).not.toMatch(/offline-v2|FixtureOrganizer|bindFixtureTransport|(?:close_event|offline_summary|finalize_event)_v2/);
        }
      }
    }
    visit(join(process.cwd(),"src","app"));
  });
  it("never dispatches an arbitrary event, v1 fallback or changed identity",async()=>{
    const rpc=vi.fn(async()=>({data:true,error:null}));
    const getUser=vi.fn(async()=>({data:{user:{id:ACTOR}},error:null}));
    vi.mocked(createClient).mockResolvedValue({auth:{getUser},rpc} as unknown as Awaited<ReturnType<typeof createClient>>);
    const transport=bindFixtureTransport(context);
    expect(await transport.verify(context)).toBe(true);
    expect(await transport.rpc("close_event",{p_event_id:EVENT})).toEqual({data:null,error:{code:"42501"}});
    expect(await transport.rpc("close_event_v2",{p_event_id:ACTOR})).toEqual({data:null,error:{code:"42501"}});
    getUser.mockResolvedValue({data:{user:{id:EVENT}},error:null});
    expect(await transport.rpc("close_event_v2",{p_event_id:EVENT})).toEqual({data:null,error:{code:"42501"}});
    expect(rpc.mock.calls).toHaveLength(2);
  });
});
