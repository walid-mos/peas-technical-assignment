import { UserStore } from "../src/userStore";
import { AdminStore } from "./../src/adminStore";

describe("UserStore class", () => {
  let userStore: UserStore;

  beforeEach(() => {
    userStore = new UserStore();
  });

  it("should allow reading allowed keys", () => {
    expect(userStore.allowedToRead("name")).toBe(true);
  });

  it("should allow writing allowed keys", () => {
    userStore.write("name", "Jhone Known");
    expect(userStore.read("name")).toBe("Jhone Known");
  });

  it("should allow reading non existing keys", () => {
    expect(userStore.allowedToRead("nonExistingKey")).toBe(true);
  });

  it("should allow writing non existing keys", () => {
    expect(userStore.allowedToWrite("nonExistingKey")).toBe(true);
  });

  it("should allow writing and reading nested keys", () => {
    userStore.write("profile:name", "John Smith");
    expect(userStore.read("profile:name")).toBe("John Smith");
  });
});

describe("AdminStore class", () => {
  let adminStore: AdminStore;

  beforeEach(() => {
    const userStore = new UserStore();
    adminStore = new AdminStore(userStore);
  });

  it("should allow reading nested keys", () => {
    expect(adminStore.read("user:name")).toBe("John Doe");
  });

  it("should disallow reading admin name", () => {
    expect(() => adminStore.read("name")).toThrow();
  });

  it("should not allow reading disallowed keys", () => {
    expect(adminStore.allowedToRead("nonExistingKey")).toBe(false);
  });

  it("should not allow writing disallowed keys", () => {
    expect(adminStore.allowedToWrite("name")).toBe(false);
  });

  it("should not allow writing disallowed keys", () => {
    expect(adminStore.allowedToWrite("nonExistingKey")).toBe(false);
  });

  it("should allow writing and reading nested keys in user", () => {
    adminStore.write("user:profile:name", "John Smith");
    expect(adminStore.read("user:profile:name")).toBe("John Smith");
  });

  it("should disallow writing nested keys in admin", () => {
    expect(() => adminStore.write("profile:name", "John Smith")).toThrow();
  });

  it("should disallow reading nested keys in admin", () => {
    expect(() => adminStore.read("profile:name")).toThrow();
  });

  it("should be allowed to read from a function result", () => {
    expect(adminStore.read("getCredentials:username")).toBe("user1");
  });
});
