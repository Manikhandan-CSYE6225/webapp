const request = require("supertest");
const app = require("../app");
const db = require("../models");
const { closeStatsDClient } = require('../metrics');

beforeAll(async () => {
    await db.sequelize.sync();
});

afterAll(async () => {
    await db.sequelize.close();
    closeStatsDClient();
});

describe("Healthz API Endpoint Tests", () => {
    test("Should return 200 on successful GET request", async () => {
        const res = await request(app).get("/healthz");
        expect(res.status).toBe(200);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });

    test("Should return 405 for non-GET requests", async () => {
        const res = await request(app).post("/healthz");
        expect(res.status).toBe(405);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });

    test("Should return 405 for non-GET requests", async () => {
        const res = await request(app).delete("/healthz");
        expect(res.status).toBe(405);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });

    test("Should return 405 for non-GET requests", async () => {
        const res = await request(app).put("/healthz");
        expect(res.status).toBe(405);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });

    test("Should return 405 for non-GET requests", async () => {
        const res = await request(app).patch("/healthz");
        expect(res.status).toBe(405);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });

    test("Should return 400 for requests with query parameters", async () => {
        const res = await request(app).get("/healthz?test=123");
        expect(res.status).toBe(400);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });

    test("Should return 400 for requests with a body", async () => {
        const res = await request(app).get("/healthz").send({ key: "value" });
        expect(res.status).toBe(400);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    });


    test("Should return 503 if database connection fails", async () => {
        jest.spyOn(db.sequelize, "authenticate").mockRejectedValue(new Error("DB Error"));

        const res = await request(app).get("/healthz");
        expect(res.status).toBe(503);
        expect(res.text).toBe("");
        expect(res.headers["content-length"]).toBe("0");
        expect(res.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");

        db.sequelize.authenticate.mockRestore();
    });
});