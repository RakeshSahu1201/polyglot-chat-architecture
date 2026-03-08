const { user_model } = require("../model/User");
const bcrypt = require("bcryptjs");

const create_user = async ({ name, password }) => {
  try {
    const hashed = await bcrypt.hash(password, 10);
    const new_user = user_model({ name, password: hashed });
    const result = await new_user.save();
    return { data: result };
  } catch (error) {
    console.log("create_user_repo error:", error.message);
    return { error: error.message };
  }
};

const get_user_by_name = async ({ name }) => {
  try {
    const [result] = await user_model.find({ name });
    return { data: result };
  } catch (error) {
    console.log("get_user_by_name error:", error.message);
    return { error: error.message };
  }
};

const get_users_without_me = async ({ me }) => {
  try {
    const result = await user_model.find(
      { _id: { $ne: me } },
      { password: 0 } // never return passwords
    );
    return { data: result };
  } catch (error) {
    console.log("get_users_without_me error:", error.message);
    return { error: error.message };
  }
};

const get_users = async () => {
  try {
    const result = await user_model.find({}, { password: 0 }); // never return passwords
    return { data: result };
  } catch (error) {
    console.log("get_users error:", error.message);
    return { error: error.message };
  }
};

module.exports = {
  create_user,
  get_user_by_name,
  get_users_without_me,
  get_users,
};
