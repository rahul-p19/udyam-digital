import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
    res.send("ok");
})

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})