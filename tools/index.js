const fs = require('fs');
const { decodeSii, encodeSii, findFirstSectionByType } = require('./siiCodec');

const data = fs.readFileSync('game.sii', 'utf8');
const parsed = decodeSii(data);

// Find economy section
const economyEntry = findFirstSectionByType(parsed, 'economy');

const companiesResult = [];

for (const entry of economyEntry.section.companies) {
  const parts = entry.split('.');
  const name = parts[2];
  const location = parts[3];

  let nameResult = companiesResult.find(v => v.code == name);
  if (!nameResult) {
    companiesResult.push({
      code: name,
      name: "?",
      output: [location],
      input: []
    });
    continue
  }

  if (!nameResult.output.includes(location)) {
    nameResult.output.push(location);
  }
}

let trucks = [];
let cargos = [];


// Full names: 
// - trailer_definition: "trailer_def.scs.flatbed.single_45sp.curtain"
// - trailer_definition: "trailer_def.scs.flatbed.single_45sp.flatbed"
let trailers = [
  {
    code: "single_45sp",
    baseType: "flatbed",
    types: [
      {
        name: "curtain",
        code: "trailer.scs_curt45s", // trailer_variant: scs_curt45s
        cargo: []
      },
      {
        name: "flatbed",
        code: "trailer.scs_flat45s", // trailer_variant: scs_flat45s
        cargo: []
      }
    ]
  }
];


let trailers1 = [];
let trailers2 = [];

function addTrailerInfo(jobInfo) {
  let { trailer_variant, trailer_definition, cargo } = jobInfo;
  if (!trailer_variant && !trailer_definition) return trailers;

  // Normalize definition into parts
  const [baseType, name, type] = trailer_definition
    .replace("trailer_def.scs.", "")
    .split(".");

  cargo = cargo; //.replace("cargo.", "");
  trailer_variant = trailer_variant; //.replace("trailer.", "");

  // Find trailer by its base code (not by its variants)
  let foundTrailer = trailers.find(t => t.code === name && t.baseType === baseType);

  // If not found, create it
  if (!foundTrailer) {
    foundTrailer = {
      code: name,
      baseType: baseType,
      types: []
    };
    trailers.push(foundTrailer);
  }

  // Check if this variant exists in that trailer
  let foundType = foundTrailer.types.find(t => t.code === trailer_variant);
  if (!foundType) {
    foundType = {
      name: type,
      code: trailer_variant,
      cargo: []
    };
    foundTrailer.types.push(foundType);
  }

  // Add cargo if new
  if (cargo && !foundType.cargo.includes(cargo)) {
    foundType.cargo.push(cargo);
  }

  return trailers;
}


for (const comp of companiesResult) {
  for (let loc of comp.output) {
    let searchTerm = `company.volatile.${comp.code}.${loc}`;

    let compInfo = parsed[searchTerm];
    if (!compInfo || !compInfo.job_offer) continue;

    for (let jobOffer of compInfo.job_offer) {
      console.log(jobOffer)

      let jobInfo = parsed[jobOffer];
      let target = jobInfo.target.replaceAll('"', "");
      console.log(jobInfo);

      const [compCode, location] = target.split(".");

      let compResult = companiesResult.find(v => v.code == compCode)
      if (compResult) {
        if (!compResult.input.includes(location)) {
          compResult.input.push(location);
        }
      }

      let truck = jobInfo.company_truck;
      let cargo = jobInfo.cargo;
      let trailer = jobInfo.trailer_variant;
      let trailer2 = jobInfo.trailer_definition;

      if (cargo && !cargos.includes(cargo)) cargos.push(cargo);
      if (truck && !trucks.includes(truck)) trucks.push(truck);
      if (trailer && !trailers1.includes(trailer)) trailers1.push(trailer);
      if (trailer2 && !trailers2.includes(trailer2)) trailers2.push(trailer2);

      addTrailerInfo(jobInfo)

    }
  }
}

// Oh boy. How the frick am I gonna figure out what trailer can transport what cargo-
// That will be so, so much fun! (Joke, it will be awful)

fs.writeFileSync("companies.json", JSON.stringify(companiesResult, null, 4))
fs.writeFileSync("trucks.json", JSON.stringify(trucks, null, 4))
// fs.writeFileSync("cargos.json", JSON.stringify(cargos, null, 4))
fs.writeFileSync("trailers.json", JSON.stringify(trailers, null, 4))
// fs.writeFileSync("trailers1.json", JSON.stringify(trailers1, null, 4))
// fs.writeFileSync("trailers2.json", JSON.stringify(trailers2, null, 4))