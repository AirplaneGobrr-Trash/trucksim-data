'use strict';

/**
 * Decode SII text into a JS object with proper arrays.
 * Keeps large numbers as strings to avoid precision loss.
 * @param {string} text - Raw .sii file content
 * @returns {object} Parsed structure
 */
function decodeSii(text) {
    const result = {};
    const stack = [];
    let current = result;

    const lines = text
        .replace(/\r/g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//'));

    for (let line of lines) {
        if (line.startsWith('SiiNunit')) continue;

        if (line.endsWith('{')) {
            // e.g. economy : _nameless.4156.4550 {
            const match = line.match(/^([\w:]+)\s*:\s*([\w.\-]+)\s*\{$/);
            if (!match) continue;
            const [, type, name] = match;
            const obj = { __type: type };
            current[name] = obj;
            stack.push(current);
            current = obj;
        } else if (line === '}') {
            current = stack.pop() || result;
        } else {
            const [keyRaw, ...rest] = line.split(':');
            if (!keyRaw) continue;
            const valRaw = rest.join(':').trim();
            if (valRaw === undefined) continue;

            let value = valRaw;

            // Handle hex floats (&3dcccccd)
            if (/^&[0-9a-f]+$/i.test(valRaw)) {
                value = valRaw;
            }
            // Handle booleans
            else if (/^(true|false)$/i.test(valRaw)) {
                value = valRaw.toLowerCase() === 'true';
            }
            // Handle numeric-like values safely
            else if (/^-?\d+(\.\d+)?$/.test(valRaw)) {
                const num = Number(valRaw);
                // Keep as string if too big or has decimals
                if (
                    !Number.isFinite(num) ||
                    Math.abs(num) > Number.MAX_SAFE_INTEGER ||
                    valRaw.includes('.')
                ) {
                    value = valRaw; // store as string
                } else {
                    value = num;
                }
            }

            // Handle array-like keys (e.g., companies[0])
            const arrayMatch = keyRaw.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [, arrName, indexStr] = arrayMatch;
                const index = Number(indexStr);
                if (!Array.isArray(current[arrName])) current[arrName] = [];
                current[arrName][index] = value;
            } else {
                current[keyRaw.trim()] = value;
            }
        }
    }

    return result;
}

/**
 * Encode JS object back to SII text
 * @param {object} obj - Parsed SII object
 * @returns {string} SII formatted text
 */
function encodeSii(obj) {
    let output = 'SiiNunit\n{\n';
    const indent = (lvl) => '\t'.repeat(lvl);

    function writeSection(name, section, level) {
        output += `${indent(level)}${section.__type} : ${name} {\n`;

        for (const [k, v] of Object.entries(section)) {
            if (k === '__type') continue;

            if (v && typeof v === 'object' && v.__type) {
                // nested section (custom ID keys)
                writeSection(k, v, level + 1);
            } else if (Array.isArray(v)) {
                output += `${indent(level + 1)}${k}: ${v.length}\n`;
                v.forEach((val, i) => {
                    output += `${indent(level + 1)}${k}[${i}]: ${val}\n`;
                });
            } else {
                output += `${indent(level + 1)}${k}: ${v}\n`;
            }
        }

        output += `${indent(level)}}\n`;
    }

    for (const [name, section] of Object.entries(obj)) {
        if (section && section.__type) writeSection(name, section, 1);
    }

    output += '}\n';
    return output;
}

/**
 * Recursively find all sections with __type === type.
 * @returns {Array<{ parent: object, key: string, section: object }>}
 */
function findSectionsByType(root, type) {
    const results = [];
    function recurse(parent) {
        for (const [key, val] of Object.entries(parent)) {
            if (val && typeof val === 'object') {
                if (val.__type === type) results.push({ parent, key, section: val });
                recurse(val);
            }
        }
    }
    recurse(root);
    return results;
}

/**
 * Find the first matching section with __type === type, or null.
 */
function findFirstSectionByType(root, type) {
    const arr = findSectionsByType(root, type);
    return arr.length ? arr[0] : null;
}

module.exports = {
    decodeSii,
    encodeSii,
    findSectionsByType,
    findFirstSectionByType,
};
