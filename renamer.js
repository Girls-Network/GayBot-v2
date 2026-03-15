const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.png'));

if (files.length === 0) {
    console.log('No PNG files found in assets/');
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
        path.join(assetsDir, `__temp_${i}.png`)
    );
});

// Rename to final numbered names
files.forEach((_, i) => {
    const newName = `${numbers[i]}.png`;
    fs.renameSync(
        path.join(assetsDir, `__temp_${i}.png`),
        path.join(assetsDir, newName)
    );
    console.log(`Renamed: ${files[i]} → ${newName}`);
});

console.log(`\nDone! ${files.length} files randomised.`);