import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

const Auth = () => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegisterClick = async () => {
    if (!name.trim() || !password.trim()) {
      alert("name and password are required");
      return;
    }
    setLoading(true);
    try {
      const result = await axios.post(`${SERVER_URL}/user/register-user`, {
        name,
        password,
      });
      if (result.data.error) {
        alert(result.data.error);
        return;
      }
      // Pass both user and token so MyChat can authenticate REST calls
      navigate("/chat", { state: { user: result.data.user, token: result.data.token } });
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginClick = async () => {
    if (!name.trim() || !password.trim()) {
      alert("name and password are required");
      return;
    }
    setLoading(true);
    try {
      const result = await axios.post(`${SERVER_URL}/user/login-user`, {
        name,
        password,
      });
      if (result.data.error) {
        alert(result.data.error);
        return;
      }
      navigate("/chat", { state: { user: result.data.user, token: result.data.token } });
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="joinOuterContainer">
      <div className="joinInnerContainer">
        <h2 className="heading">
          <img
            className="logo"
            src="https://image.flaticon.com/icons/svg/2950/2950581.svg"
            alt="logo"
          />{" "}
          ChatGram
        </h2>
        <div>
          <input
            placeholder="Name"
            className="joinInput input-box"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <input
            placeholder="Password"
            className="joinInput input-box"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="button mt-20"
          type="button"
          onClick={handleRegisterClick}
          disabled={loading}
        >
          {loading ? "..." : "Register"}
        </button>
        <button
          className="button mt-20"
          type="button"
          onClick={handleLoginClick}
          disabled={loading}
        >
          {loading ? "..." : "Login"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
