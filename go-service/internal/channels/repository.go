package channels

import (
	"context"
	"fmt"

	"github.com/polyglot-chat/go-service/pkg/db"
)

type Channel struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	InviteCode string `json:"invite_code"`
	OwnerID    string `json:"owner_id"`
}

type Message struct {
	ID        string `json:"id"`
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
	UserName  string `json:"user_name"`
	Body      string `json:"body"`
	MediaURL  string `json:"media_url,omitempty"`
	CreatedAt string `json:"created_at"`
}

func CreateChannel(ctx context.Context, name, chType, inviteCode, ownerID string) (*Channel, error) {
	ch := &Channel{}
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO channels (name, type, invite_code, owner_id)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, type, invite_code, owner_id`,
		name, chType, inviteCode, ownerID,
	).Scan(&ch.ID, &ch.Name, &ch.Type, &ch.InviteCode, &ch.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("CreateChannel: %w", err)
	}
	// Auto-add the owner as member
	_, err = db.Pool.Exec(ctx,
		`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		ch.ID, ownerID,
	)
	return ch, err
}

func GetChannelByInviteCode(ctx context.Context, code string) (*Channel, error) {
	ch := &Channel{}
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, type, invite_code, owner_id FROM channels WHERE invite_code = $1`,
		code,
	).Scan(&ch.ID, &ch.Name, &ch.Type, &ch.InviteCode, &ch.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("GetChannelByInviteCode: %w", err)
	}
	return ch, nil
}

func GetChannelByID(ctx context.Context, id string) (*Channel, error) {
	ch := &Channel{}
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, type, invite_code, owner_id FROM channels WHERE id = $1`,
		id,
	).Scan(&ch.ID, &ch.Name, &ch.Type, &ch.InviteCode, &ch.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("GetChannelByID: %w", err)
	}
	return ch, nil
}

func JoinChannel(ctx context.Context, channelID, userID string) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		channelID, userID,
	)
	return err
}

func IsMember(ctx context.Context, channelID, userID string) (bool, error) {
	var count int
	err := db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
		channelID, userID,
	).Scan(&count)
	return count > 0, err
}

func SaveMessage(ctx context.Context, channelID, userID, userName, body string) (*Message, error) {
	msg := &Message{}
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO channel_messages (channel_id, user_id, user_name, body)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, channel_id, user_id, user_name, body, created_at`,
		channelID, userID, userName, body,
	).Scan(&msg.ID, &msg.ChannelID, &msg.UserID, &msg.UserName, &msg.Body, &msg.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("SaveMessage: %w", err)
	}
	return msg, nil
}

func GetMessages(ctx context.Context, channelID string, limit int) ([]Message, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, channel_id, user_id, user_name, body, created_at
		 FROM channel_messages
		 WHERE channel_id = $1
		 ORDER BY created_at ASC
		 LIMIT $2`,
		channelID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ChannelID, &m.UserID, &m.UserName, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}

func GetUserChannels(ctx context.Context, userID string) ([]Channel, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT c.id, c.name, c.type, c.invite_code, c.owner_id
		 FROM channels c
		 JOIN channel_members cm ON c.id = cm.channel_id
		 WHERE cm.user_id = $1
		 ORDER BY c.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Type, &ch.InviteCode, &ch.OwnerID); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}
