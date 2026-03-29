// Password complexity regex: At least 8 characters, one uppercase, one lowercase, one number and one special character
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const validatePassword = (password) => {
    return passwordRegex.test(password);
};
