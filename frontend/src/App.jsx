import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MyChat from "./pages/chat/MyChat";
import Auth from "./pages/auth/Auth";

import { Toaster } from 'react-hot-toast';

const App = () => {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/chat" element={<MyChat />} />
        <Route path="/" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
