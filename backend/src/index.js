require("dotenv").config();
const { assertJwtSecretAtBoot } = require("./middleware/jwtSecret");
assertJwtSecretAtBoot();

const { createApp } = require("./app");

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => console.log(`✅ TAWSS API running on port ${PORT}`));
