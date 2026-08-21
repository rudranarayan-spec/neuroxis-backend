export const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: "ONLINE",
    app: "NEUROXIS Engine v1.0",
    timestamp: new Date().toISOString(),
  });
};
