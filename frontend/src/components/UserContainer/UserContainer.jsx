import "./UserContainer.css";

const UserContainer = ({ users, setTo, activeTo }) => {
  const handleToClick = (e) => {
    const id = e.currentTarget.getAttribute("id");
    setTo(id);
  };

  const onlineCount = users ? users.filter(u => u.isOnline).length : 0;

  return (
    <div className="textContainer">
      {users && users.length > 0 ? (
        <div className="user-container">
          <h3>Users (Online: {onlineCount})</h3>
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
                  color: activeTo === user._id ? '#818cf8' : (user.isOnline ? '#e2e8f0' : '#64748b'),
                  fontWeight: activeTo === user._id ? '600' : '400',
                  borderRadius: activeTo === user._id ? '6px' : '0',
                  opacity: user.isOnline ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: user.isOnline ? '#10b981' : '#475569',
                  boxShadow: user.isOnline ? '0 0 5px #10b981' : 'none'
                }}></div>
                {user.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="user-container">
          <h3>Users — 0</h3>
          <p style={{ color: "#4a5168", fontSize: "0.8rem", padding: "8px 20px" }}>
            No users found
          </p>
        </div>
      )}
    </div>
  );
};

export default UserContainer;
