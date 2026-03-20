package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			StorageKey("id"),
		field.String("name").
			Unique().
			NotEmpty(),
		field.String("password").
			Sensitive(), // excluded from JSON serialisation
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		// A user owns many channels
		edge.To("owned_channels", Channel.Type),
		// A user has many channel memberships (via ChannelMember)
		edge.To("memberships", ChannelMember.Type),
		// A user has sent many channel messages
		edge.To("channel_messages", ChannelMessage.Type),
	}
}
