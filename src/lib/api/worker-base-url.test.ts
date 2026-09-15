import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { workerBaseUrl } from "./worker-base-url";

const ORIGINAL_ENV = process.env["WORKER_BASE_URL"];

beforeEach(() => {
  delete process.env["WORKER_BASE_URL"];
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env["WORKER_BASE_URL"];
  } else {
    process.env["WORKER_BASE_URL"] = ORIGINAL_ENV;
  }
});

describe("workerBaseUrl", () => {
  it("mantém o site publicado", () => {
    expect(workerBaseUrl("https://ailou-studio.vercel.app/api")).toBe(
      "https://ailou-studio.vercel.app",
    );
  });

  it("mantém domínio próprio", () => {
    expect(workerBaseUrl("https://studio.ailou.com.br/api")).toBe("https://studio.ailou.com.br");
  });

  it("mantém localhost", () => {
    expect(workerBaseUrl("http://localhost:8080/api")).toBe("http://localhost:8080");
  });

  it("usa WORKER_BASE_URL quando definida", () => {
    process.env["WORKER_BASE_URL"] = "https://studio.ailou.com.br";
    expect(workerBaseUrl("https://something-else.vercel.app/api")).toBe(
      "https://studio.ailou.com.br",
    );
  });

  it("remove barra final do WORKER_BASE_URL", () => {
    process.env["WORKER_BASE_URL"] = "https://studio.ailou.com.br/";
    expect(workerBaseUrl("https://x.vercel.app")).toBe("https://studio.ailou.com.br");
  });
});
