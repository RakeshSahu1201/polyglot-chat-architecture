import "./UserContainer.css";

const UserContainer = ({ users, setTo, activeTo }) => {
  const handleToClick = (e) => {
    const id = e.currentTarget.getAttribute("id");
    setTo(id);
  };

  return (
    <div className="textContainer">
      {users && users.length > 0 ? (
        <div className="user-container">
          <h3>Online — {users.length}</h3>
          <div className="activeContainer">
            {users.map((user) => (
              <div
                key={user._id}
                className="activeItem"
                id={user._id}
                data-initial={user.name?.[0]?.toUpperCase() ?? "?"}
                onClick={handleToClick}
                title={user.name}
                style={{
                  background: activeTo === user._id ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                  color: activeTo === user._id ? '#818cf8' : '#e2e8f0',
                  fontWeight: activeTo === user._id ? '600' : '400',
                  borderRadius: activeTo === user._id ? '6px' : '0'
                }}
              >
                {user.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="user-container">
          <h3>Online — 0</h3>
          <p style={{ color: "#4a5168", fontSize: "0.8rem", padding: "8px 20px" }}>
            No other users online
          </p>
        </div>
      )}
    </div>
  );
};

export default UserContainer;
