describe("api config", () => {
  const originalEnv = process.env.REACT_APP_BACKEND_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REACT_APP_BACKEND_URL;
    } else {
      process.env.REACT_APP_BACKEND_URL = originalEnv;
    }
    jest.resetModules();
  });

  it("falls back to the local PHP backend when no env var is set", () => {
    delete process.env.REACT_APP_BACKEND_URL;

    jest.isolateModules(() => {
      const { API_URL } = require("./api");
      expect(API_URL).toBe("http://localhost:8000/api");
    });
  });

  it("normalizes validation-error objects into readable messages", () => {
    jest.isolateModules(() => {
      const { getApiErrorMessage } = require("./api");
      const result = getApiErrorMessage({ response: { data: { detail: [{ msg: "Password is required", type: "string" }] } } }, "Fallback");
      expect(result).toBe("Password is required");
    });
  });

  it("formats missing or underscored role labels without crashing", () => {
    jest.isolateModules(() => {
      const { formatRoleLabel } = require("./utils");
      expect(formatRoleLabel()).toBe("");
      expect(formatRoleLabel("super_admin")).toBe("super admin");
      expect(formatRoleLabel("admin")).toBe("admin");
    });
  });
});
