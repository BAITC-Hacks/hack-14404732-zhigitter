const required = ["OPENAI_API_KEY", "EKT_API_USERNAME", "EKT_API_PASSWORD", "CART_SIGNING_SECRET"];
let missing = false;
for (const name of required) {
  const present = Boolean(process.env[name]?.trim());
  console.log(`${name}: ${present ? "configured" : "missing"}`);
  missing ||= !present;
}
if (process.env.CART_SIGNING_SECRET && process.env.CART_SIGNING_SECRET.length < 32) {
  console.log("CART_SIGNING_SECRET: needs at least 32 characters");
  missing = true;
}
console.log("Only presence was checked; API access is not verified by this command.");
process.exitCode = missing ? 1 : 0;
