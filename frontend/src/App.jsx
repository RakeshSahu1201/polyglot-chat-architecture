import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MyChat from "./pages/chat/MyChat";
import Auth from "./pages/auth/Auth";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/chat" element={<MyChat />} />
        <Route path="/" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
