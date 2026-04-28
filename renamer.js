/** This file was created to randomise the names of the PNG files in assets/ for the banner rotator system I implemented.
 * Created by Clove on 2026-03-15.
 * Feel free to copy this, this one is pretty much a one-off script and not part of the bot's main codebase, but I don't want to lose it in case I need to randomise the names again in the future.
 * Usage: node renamer.js
 * works without needing any extra dependencies, just make sure to have Node.js installed and run it in the terminal while being in the same directory as this file.
 * LICENCE EXEMPTION: You can use this code in your own projects without needing to credit me or anything, it's a simple utility script and I don't mind if people use it.
 */

const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "assets");
const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".png"));

if (files.length === 0) {
    console.log("No PNG files found in assets/");
    process.exit(1);
}

// Generate a shuffled array of numbers 1..n
const numbers = Array.from({ length: files.length }, (_, i) => i + 1);
for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
}

// Rename to temp names first to avoid collisions
files.forEach((file, i) => {
    fs.renameSync(
        path.join(assetsDir, file),
        path.join(assetsDir, `__temp_${i}.png`),
    );
});

// Rename to final numbered names
files.forEach((_, i) => {
    const newName = `${numbers[i]}.png`;
    fs.renameSync(
        path.join(assetsDir, `__temp_${i}.png`),
        path.join(assetsDir, newName),
    );
    console.log(`Renamed: ${files[i]} → ${newName}`);
});

console.log(`\nDone! ${files.length} files randomised.`);
