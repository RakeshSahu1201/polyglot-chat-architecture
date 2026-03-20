package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// ChannelMember holds the schema definition for the ChannelMember entity (join table).
type ChannelMember struct {
	ent.Schema
}

// Fields of the ChannelMember.
func (ChannelMember) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New),
		field.UUID("channel_id", uuid.UUID{}),
		field.UUID("user_id", uuid.UUID{}),
		field.Time("joined_at").
			Default(time.Now).
			Immutable(),
		field.Enum("status").
			Values("pending", "approved").
			Default("approved"),
	}
}

// Edges of the ChannelMember.
func (ChannelMember) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("channel", Channel.Type).
			Ref("memberships").
			Field("channel_id").
			Required().
			Unique(),
		edge.From("user", User.Type).
			Ref("memberships").
			Field("user_id").
			Required().
			Unique(),
	}
}
