import bcrypt from 'bcrypt'

const hashPassword = async (password) => {
    const salt = process.env.saltRounds
    return await bcrypt.hash(password, parseInt(salt)).then((hash) => {
        return hash
    })
}

const comparePassword = async (plain,hash) =>{
  return await bcrypt.compare(plain, hash).then((result) => {
    return result
  })
}

export default {
  hashPassword,
  comparePassword
}
