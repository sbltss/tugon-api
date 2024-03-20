import rateLimit from 'express-rate-limit';

export const accountLimit = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	//windowMs: 24 * 60 * 60 * 1000, // 24 hrs in milliseconds
  // windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // start blocking after 5 requests
  message: "Too many login attempts from this IP, please try again later", 
  headers: true,
});
