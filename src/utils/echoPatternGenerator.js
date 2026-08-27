// Generates a random sequence of tile indices based on length
export const generateEchoSequence = (length = 6, gridSize = 9) => {
  const sequence = [];
  for (let i = 0; i < length; i++) {
    sequence.push(Math.floor(Math.random() * gridSize));
  }
  return sequence;
};