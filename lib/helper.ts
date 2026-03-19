function createUserEmail() {
  return `user_${Math.random().toString(36).substring(2, 15)}@example.com`;
}

function createUserPassword() {
  return Math.random().toString(36).substring(2, 15);
}

export { createUserEmail, createUserPassword };
