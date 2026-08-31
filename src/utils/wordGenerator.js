// src/utils/wordGenerator.js

const WORD_DICTIONARY = {
  EASY: ['CODE', 'BYTE', 'NODE', 'DATA', 'LOOP'],
  MEDIUM: ['REACT', 'MONGO', 'REDEX', 'STACK', 'SWIFT'],
  HARD: ['EXPRESS', 'NEURAL', 'CYBER', 'ROUTER', 'ASYNCS'],
};

export const getRandomWord = (difficulty = 'MEDIUM') => {
  const upperDiff = difficulty.toUpperCase();
  const pool = WORD_DICTIONARY[upperDiff] || WORD_DICTIONARY.MEDIUM;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};

export const isValidWord = (word) => {
  if (!word) return false;
  // Optional: add dictionary checking logic here if accepting any valid English word
  return true;
};