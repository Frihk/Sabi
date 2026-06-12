const rateLimitMap = new Map()

// Simple rate limiter middleware
// Default: 10 requests per minute per IP
function rateLimiter(limit = 10, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const now = Date.now()

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, [])
    }

    const timestamps = rateLimitMap.get(ip)
    // Filter out old timestamps
    const activeTimestamps = timestamps.filter(t => now - t < windowMs)
    
    if (activeTimestamps.length >= limit) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      })
    }

    activeTimestamps.push(now)
    rateLimitMap.set(ip, activeTimestamps)
    next()
  }
}
