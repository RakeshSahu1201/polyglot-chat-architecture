package auth

import (
	"context"
	"fmt"

	"github.com/polyglot-chat/go-service/pkg/db"
)

type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Password string `json:"-"` // never serialised
}

func CreateUser(ctx context.Context, name, hashedPassword string) (*User, error) {
	u := &User{}
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO users (name, password) VALUES ($1, $2)
		 RETURNING id, name`,
		name, hashedPassword,
	).Scan(&u.ID, &u.Name)
	if err != nil {
		return nil, fmt.Errorf("CreateUser: %w", err)
	}
	return u, nil
}

func GetUserByName(ctx context.Context, name string) (*User, error) {
	u := &User{}
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, password FROM users WHERE name = $1`,
		name,
	).Scan(&u.ID, &u.Name, &u.Password)
	if err != nil {
		return nil, fmt.Errorf("GetUserByName: %w", err)
	}
	return u, nil
}

func GetUserByID(ctx context.Context, id string) (*User, error) {
	u := &User{}
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Name)
	if err != nil {
		return nil, fmt.Errorf("GetUserByID: %w", err)
	}
	return u, nil
}

func GetUsers(ctx context.Context) ([]*User, error) {
	rows, err := db.Pool.Query(ctx, `SELECT id, name FROM users ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("GetUsers: %w", err)
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		u := &User{}
		if err := rows.Scan(&u.ID, &u.Name); err != nil {
			return nil, fmt.Errorf("GetUsers scan: %w", err)
		}
		users = append(users, u)
	}
	return users, nil
}
