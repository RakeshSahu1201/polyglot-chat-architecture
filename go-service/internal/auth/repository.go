package auth

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/polyglot-chat/go-service/ent"
	"github.com/polyglot-chat/go-service/ent/user"
	"github.com/polyglot-chat/go-service/pkg/db"
)

// User is a plain data-transfer struct returned from this package.
// We keep it so handlers don't import the generated ent types directly.
type User struct {
	ID       string `json:"_id"`
	Name     string `json:"name"`
	Password string `json:"-"` // never serialised
}

func entToUser(u *ent.User) *User {
	return &User{ID: u.ID.String(), Name: u.Name, Password: u.Password}
}

// CreateUser inserts a new user and returns the saved record.
func CreateUser(ctx context.Context, name, hashedPassword string) (*User, error) {
	u, err := db.Client.User.
		Create().
		SetName(name).
		SetPassword(hashedPassword).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("CreateUser: %w", err)
	}
	return entToUser(u), nil
}

// GetUserByName looks up a user by their unique name (for login).
func GetUserByName(ctx context.Context, name string) (*User, error) {
	u, err := db.Client.User.
		Query().
		Where(user.Name(name)).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetUserByName: %w", err)
	}
	return entToUser(u), nil
}

// GetUserByID looks up a user by UUID (for JWT /me endpoint).
func GetUserByID(ctx context.Context, id string) (*User, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("GetUserByID parse: %w", err)
	}
	u, err := db.Client.User.Get(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("GetUserByID: %w", err)
	}
	return entToUser(u), nil
}

// GetUsers returns all users ordered by name, excluding passwords.
func GetUsers(ctx context.Context) ([]*User, error) {
	rows, err := db.Client.User.
		Query().
		Order(ent.Asc(user.FieldName)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetUsers: %w", err)
	}
	result := make([]*User, len(rows))
	for i, u := range rows {
		result[i] = entToUser(u)
	}
	return result, nil
}
