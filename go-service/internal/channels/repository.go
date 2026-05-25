package channels

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/polyglot-chat/go-service/ent"
	"github.com/polyglot-chat/go-service/ent/channel"
	"github.com/polyglot-chat/go-service/ent/channelmember"
	"github.com/polyglot-chat/go-service/ent/channelmessage"
	"github.com/polyglot-chat/go-service/pkg/db"
)

// ── Plain DTOs (decoupled from generated ent types) ─────────────────────────

type Channel struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	InviteCode string `json:"invite_code"`
	OwnerID    string `json:"owner_id"`
	Archived   bool   `json:"archived"`
}

type Message struct {
	ID        string    `json:"id"`
	ChannelID string    `json:"channel_id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	Body      string    `json:"body"`
	MediaURL  string    `json:"media_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// ChannelWithCount is Channel + member count for the settings panel.
type ChannelWithCount struct {
	Channel
	MemberCount int `json:"member_count"`
}

// MemberInfo is a lightweight member summary for the settings panel.
type MemberInfo struct {
	MembershipID string    `json:"membership_id"`
	UserID       string    `json:"user_id"`
	UserName     string    `json:"user_name"`
	Status       string    `json:"status"`
	JoinedAt     time.Time `json:"joined_at"`
}

func entToChannel(c *ent.Channel) Channel {
	return Channel{
		ID:         c.ID.String(),
		Name:       c.Name,
		Type:       c.Type,
		InviteCode: c.InviteCode,
		OwnerID:    c.OwnerID.String(),
		Archived:   c.ArchivedAt != nil,
	}
}

func entToMessage(m *ent.ChannelMessage) Message {
	msg := Message{
		ID:        m.ID.String(),
		ChannelID: m.ChannelID.String(),
		UserID:    m.UserID.String(),
		UserName:  m.UserName,
		Body:      m.Body,
		CreatedAt: m.CreatedAt,
	}
	if m.MediaURL != nil {
		msg.MediaURL = *m.MediaURL
	}
	return msg
}

// ── Repository Functions ─────────────────────────────────────────────────────

// CreateChannel creates a new channel and auto-adds the owner as a member.
func CreateChannel(ctx context.Context, name, chType, inviteCode, ownerID string) (*Channel, error) {
	ownerUUID, err := uuid.Parse(ownerID)
	if err != nil {
		return nil, fmt.Errorf("CreateChannel parse ownerID: %w", err)
	}

	ch, err := db.Client.Channel.
		Create().
		SetName(name).
		SetType(chType).
		SetInviteCode(inviteCode).
		SetOwnerID(ownerUUID).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("CreateChannel: %w", err)
	}

	// Auto-add owner as first member (approved)
	exists, _ := db.Client.ChannelMember.Query().
		Where(
			channelmember.ChannelID(ch.ID),
			channelmember.UserID(ownerUUID),
		).Exist(ctx)
	if !exists {
		_ = db.Client.ChannelMember.Create().
			SetChannelID(ch.ID).
			SetUserID(ownerUUID).
			SetStatus(channelmember.StatusApproved).
			Exec(ctx)
	}

	result := entToChannel(ch)
	return &result, nil
}

// GetChannelByInviteCode looks up a channel by its unique invite code.
func GetChannelByInviteCode(ctx context.Context, code string) (*Channel, error) {
	ch, err := db.Client.Channel.
		Query().
		Where(
			channel.InviteCode(code),
			channel.ArchivedAtIsNil(),
		).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetChannelByInviteCode: %w", err)
	}
	result := entToChannel(ch)
	return &result, nil
}

// GetChannelByID looks up a channel by its UUID.
func GetChannelByID(ctx context.Context, id string) (*Channel, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("GetChannelByID parse: %w", err)
	}
	ch, err := db.Client.Channel.Get(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("GetChannelByID: %w", err)
	}
	result := entToChannel(ch)
	return &result, nil
}

// JoinChannel adds a user to a channel with a specific status (pending/approved).
func JoinChannel(ctx context.Context, channelID, userID, status string) error {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return fmt.Errorf("JoinChannel parse channelID: %w", err)
	}
	active, err := db.Client.Channel.
		Query().
		Where(
			channel.ID(chID),
			channel.ArchivedAtIsNil(),
		).
		Exist(ctx)
	if err != nil {
		return fmt.Errorf("JoinChannel channel check: %w", err)
	}
	if !active {
		return fmt.Errorf("JoinChannel: channel is archived")
	}

	uID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("JoinChannel parse userID: %w", err)
	}

	entStatus := channelmember.StatusApproved
	if status == "pending" {
		entStatus = channelmember.StatusPending
	}

	exists, err := db.Client.ChannelMember.Query().
		Where(
			channelmember.ChannelID(chID),
			channelmember.UserID(uID),
		).Exist(ctx)
	if err != nil {
		return fmt.Errorf("JoinChannel check: %w", err)
	}
	if exists {
		return nil // already a member or pending
	}
	return db.Client.ChannelMember.Create().
		SetChannelID(chID).
		SetUserID(uID).
		SetStatus(entStatus).
		Exec(ctx)
}

// IsMember checks if a user is an APPROVED member of a channel.
func IsMember(ctx context.Context, channelID, userID string) (bool, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return false, fmt.Errorf("IsMember parse channelID: %w", err)
	}
	uID, err := uuid.Parse(userID)
	if err != nil {
		return false, fmt.Errorf("IsMember parse userID: %w", err)
	}
	count, err := db.Client.ChannelMember.
		Query().
		Where(
			channelmember.ChannelID(chID),
			channelmember.UserID(uID),
			channelmember.StatusEQ(channelmember.StatusApproved),
		).
		Count(ctx)
	return count > 0, err
}

// SaveMessage persists a new channel message and returns the saved record.
func SaveMessage(ctx context.Context, channelID, userID, userName, body, mediaURL string) (*Message, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return nil, fmt.Errorf("SaveMessage parse channelID: %w", err)
	}

	active, err := db.Client.Channel.
		Query().
		Where(
			channel.ID(chID),
			channel.ArchivedAtIsNil(),
		).
		Exist(ctx)
	if err != nil {
		return nil, fmt.Errorf("SaveMessage channel check: %w", err)
	}
	if !active {
		return nil, fmt.Errorf("SaveMessage: channel is archived")
	}

	uID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("SaveMessage parse userID: %w", err)
	}
	builder := db.Client.ChannelMessage.
		Create().
		SetChannelID(chID).
		SetUserID(uID).
		SetUserName(userName).
		SetBody(body)
	if mediaURL != "" {
		builder.SetMediaURL(mediaURL)
	}
	m, err := builder.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("SaveMessage: %w", err)
	}
	if err := db.Client.Channel.UpdateOneID(chID).
		SetLastActivityAt(time.Now()).
		Exec(ctx); err != nil {
		return nil, fmt.Errorf("SaveMessage update channel activity: %w", err)
	}
	result := entToMessage(m)
	return &result, nil
}

// GetMessages retrieves the last `limit` messages for a channel, ordered ASC.
func GetMessages(ctx context.Context, channelID string, limit int) ([]Message, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return nil, fmt.Errorf("GetMessages parse channelID: %w", err)
	}
	rows, err := db.Client.ChannelMessage.
		Query().
		Where(channelmessage.ChannelID(chID)).
		Order(ent.Asc(channelmessage.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetMessages: %w", err)
	}
	msgs := make([]Message, len(rows))
	for i, m := range rows {
		msgs[i] = entToMessage(m)
	}
	return msgs, nil
}

// GetUserChannels returns all channels a user is an APPROVED member of.
func GetUserChannels(ctx context.Context, userID string) ([]Channel, error) {
	uID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("GetUserChannels parse userID: %w", err)
	}

	// Query ChannelMember records for this user, eager-load the Channel edge
	memberships, err := db.Client.ChannelMember.
		Query().
		Where(
			channelmember.UserID(uID),
			channelmember.StatusEQ(channelmember.StatusApproved),
			channelmember.HasChannelWith(channel.ArchivedAtIsNil()),
		).
		WithChannel().
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetUserChannels: %w", err)
	}

	channels := make([]Channel, 0, len(memberships))
	for _, m := range memberships {
		if m.Edges.Channel != nil {
			channels = append(channels, entToChannel(m.Edges.Channel))
		}
	}
	return channels, nil
}

func IsChannelArchived(ctx context.Context, channelID string) (bool, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return false, fmt.Errorf("IsChannelArchived parse channelID: %w", err)
	}

	archived, err := db.Client.Channel.
		Query().
		Where(
			channel.ID(chID),
			channel.ArchivedAtNotNil(),
		).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("IsChannelArchived: %w", err)
	}

	return archived, nil
}

// GetChannelWithMemberCount returns channel metadata + total APPROVED member count.
func GetChannelWithMemberCount(ctx context.Context, channelID string) (*ChannelWithCount, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return nil, fmt.Errorf("GetChannelWithMemberCount parse: %w", err)
	}
	ch, err := db.Client.Channel.Get(ctx, chID)
	if err != nil {
		return nil, err
	}
	count, err := db.Client.ChannelMember.Query().
		Where(
			channelmember.ChannelID(chID),
			channelmember.StatusEQ(channelmember.StatusApproved),
		).
		Count(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetChannelWithMemberCount count: %w", err)
	}
	base := entToChannel(ch)
	return &ChannelWithCount{Channel: base, MemberCount: count}, nil
}

// GetChannelMembers returns all members (approved or pending) for the settings panel.
func GetChannelMembers(ctx context.Context, channelID string) ([]MemberInfo, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return nil, fmt.Errorf("GetChannelMembers parse: %w", err)
	}
	memberships, err := db.Client.ChannelMember.
		Query().
		Where(channelmember.ChannelID(chID)).
		WithUser().
		Order(ent.Asc(channelmember.FieldJoinedAt)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("GetChannelMembers: %w", err)
	}
	result := make([]MemberInfo, 0, len(memberships))
	for _, m := range memberships {
		name := ""
		if m.Edges.User != nil {
			name = m.Edges.User.Name
		}
		result = append(result, MemberInfo{
			MembershipID: m.ID.String(),
			UserID:       m.UserID.String(),
			UserName:     name,
			Status:       string(m.Status),
			JoinedAt:     m.JoinedAt,
		})
	}
	return result, nil
}

// RenameChannel updates the channel name.
func RenameChannel(ctx context.Context, channelID, newName string) (*Channel, error) {
	chID, err := uuid.Parse(channelID)
	if err != nil {
		return nil, fmt.Errorf("RenameChannel parse: %w", err)
	}
	ch, err := db.Client.Channel.UpdateOneID(chID).
		SetName(newName).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("RenameChannel: %w", err)
	}
	result := entToChannel(ch)
	return &result, nil
}

// ApproveMember sets a membership status to approved.
func ApproveMember(ctx context.Context, membershipID string) error {
	mID, err := uuid.Parse(membershipID)
	if err != nil {
		return fmt.Errorf("ApproveMember parse: %w", err)
	}
	return db.Client.ChannelMember.UpdateOneID(mID).
		SetStatus(channelmember.StatusApproved).
		Exec(ctx)
}

// RemoveMember deletes a membership record (reject or kick).
func RemoveMember(ctx context.Context, membershipID string) error {
	mID, err := uuid.Parse(membershipID)
	if err != nil {
		return fmt.Errorf("RemoveMember parse: %w", err)
	}
	return db.Client.ChannelMember.DeleteOneID(mID).Exec(ctx)
}

// GetMembershipByID retrieves a single membership record.
func GetMembershipByID(ctx context.Context, id string) (*ent.ChannelMember, error) {
	uID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("GetMembershipByID parse: %w", err)
	}
	return db.Client.ChannelMember.Get(ctx, uID)
}
