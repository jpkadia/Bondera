import { randomInt } from "crypto";
import { UNIQUE_ID_ALPHABET, UNIQUE_ID_LENGTH } from "../constants/auth";

export const generateUniqueId = (): string => {
  let uniqueId = "";

  for (let index = 0; index < UNIQUE_ID_LENGTH; index += 1) {
    uniqueId += UNIQUE_ID_ALPHABET[randomInt(UNIQUE_ID_ALPHABET.length)];
  }

  return uniqueId;
};

