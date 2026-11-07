import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CheckpointsLoading from "./loading";

describe("checkpoint loading", () => {
  it("announces the loading state", () => {
    render(<CheckpointsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading event checkpoints");
  });
});
