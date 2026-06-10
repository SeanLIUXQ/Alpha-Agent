import dateFormatter from "./dateFormatter";

it("should format an ISO string", () => {
  const ISOString = "2020-01-01T12:11:08.212Z";

  expect(dateFormatter(ISOString)).toBe("2020年1月1日");
});
