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
});
