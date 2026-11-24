// Teaches Baileys' generated protobuf code the "sound sticker" fields, which its
// WAProto (Nov 2025, still the latest release) predates. Without this, Baileys
// silently drops them: a received sound sticker decodes as an empty message and
// an outgoing one loses its audio.
//
// Layout captured from a real sound sticker on 2026-11-24 (matches whatsmeow's
// proto, WhatsApp v1047451014+):
//   Message.audioStickerMessage = 134 (FutureProofMessage { message = 1 })
//     .message.stickerMessage  : regular StickerMessage (image/webp) plus
//       premium = 24 (int32), emojis = 25 (string),
//       audioMessage = 26 (AudioMessage: its own upload, audio/ogg; codecs=opus)
//
// The generated code is wrapped, not edited: encode appends the extra fields,
// decode re-reads the same bytes for them. Nested types are looked up through
// `$root.proto...` at call time, so the wrappers also apply inside quoted and
// FutureProof messages. If a future Baileys knows a field natively, that field
// is left alone. applyProtoExtensions() verifies the round trip and throws when
// it fails, so a Baileys upgrade that breaks this fails at startup.
import protobuf from 'protobufjs/minimal.js';
import { proto } from '@whiskeysockets/baileys';

const { Reader } = protobuf;
const WIRE_VARINT = 0;
const WIRE_BYTES = 2;

// field: [name, wireType, encodeValue(writer, value), decodeValue(reader)]
const extensions = () => [
    [proto.Message.StickerMessage, [
        [24, 'premium', WIRE_VARINT, (w, v) => w.int32(v), (r) => r.int32()],
        [25, 'emojis', WIRE_BYTES, (w, v) => w.string(v), (r) => r.string()],
        [26, 'audioMessage', WIRE_BYTES, (w, v) => proto.Message.AudioMessage.encode(v, w.fork()).ldelim(), (r) => proto.Message.AudioMessage.decode(r, r.uint32())]
    ]],
    [proto.Message, [
        [134, 'audioStickerMessage', WIRE_BYTES, (w, v) => proto.Message.FutureProofMessage.encode(v, w.fork()).ldelim(), (r) => proto.Message.FutureProofMessage.decode(r, r.uint32())]
    ]]
];

// True when the generated code already round-trips the field on its own.
function nativelySupported(Type, [, name, wire]) {
    const sample = wire === WIRE_VARINT ? 1 : name === 'emojis' ? 'x' : {};
    try {
        return Type.decode(Type.encode({ [name]: sample }).finish())[name] != null;
    }
    catch {
        return false;
    }
}

function extend(Type, fields) {
    const missing = fields.filter((field) => !nativelySupported(Type, field));
    if (!missing.length)
        return;
    const byNumber = new Map(missing.map((field) => [field[0], field]));
    const encode = Type.encode;
    const decode = Type.decode;
    Type.encode = function encodeWithExtensions(m, w) {
        w = encode.call(this, m, w);
        for (const [number, name, wire, write] of missing) {
            if (m[name] != null && Object.hasOwn(m, name))
                write(w.uint32((number << 3) | wire), m[name]);
        }
        return w;
    };
    Type.decode = function decodeWithExtensions(r, l, e) {
        const reader = r instanceof Reader ? r : Reader.create(r);
        const start = reader.pos;
        const m = decode.call(this, reader, l, e);
        const scan = Reader.create(reader.buf.subarray(start, reader.pos));
        while (scan.pos < scan.len) {
            const tag = scan.uint32();
            const field = byNumber.get(tag >>> 3);
            if (field && (tag & 7) === field[2])
                m[field[1]] = field[4](scan);
            else
                scan.skipType(tag & 7);
        }
        return m;
    };
}

let applied = false;

export function applyProtoExtensions() {
    if (applied)
        return;
    for (const [Type, fields] of extensions())
        extend(Type, fields);
    applied = true;
    const probe = { audioStickerMessage: { message: { stickerMessage: { mimetype: 'image/webp', premium: 0, emojis: '😂', audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 4 } } } } };
    const back = proto.Message.decode(proto.Message.encode(probe).finish());
    const sticker = back.audioStickerMessage?.message?.stickerMessage;
    if (sticker?.audioMessage?.seconds !== 4 || sticker.emojis !== '😂' || sticker.mimetype !== 'image/webp')
        throw new Error('Sound sticker protobuf extension failed its round trip; check the Baileys WAProto version');
}
