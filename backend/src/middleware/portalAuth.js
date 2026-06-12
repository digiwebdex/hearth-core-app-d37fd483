const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./jwtSecret");

const SECRET = getJwtSecret();
const PORTAL_AUDIENCE = "portal";

/**
 * Verify a portal JWT (audience = "portal").
 * Sets req.portalUser = { email, roles: ["customer"|"supplier"|"agent"] }
 */
function portalAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token provided" });
  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, SECRET, { audience: PORTAL_AUDIENCE });
    req.portalUser = { email: decoded.email, roles: decoded.roles || [] };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired portal token" });
  }
}

module.exports = { portalAuthenticate, PORTAL_AUDIENCE, SECRET };
