/**
 * KSP Image v0.9.1 — 100 Pose Presets (Engine A+)
 *
 * Travel/outdoor/TikTok-genre poses curated from Vietnamese KOL photography
 * (Vũ Diệu Thuý, ELLE, foody, kkday, dulichvietnam.com.vn).
 *
 * Each pose has:
 *   - vi: Vietnamese name shown in UI
 *   - en: English description injected verbatim into *Position:* block
 *   - category: for grouping in dropdown
 *   - framing: recommended shot type (full / medium / close_up)
 *   - mood: which moods this pose pairs naturally with
 */

export type PoseCategory =
  | "walking"
  | "standing"
  | "sitting"
  | "lying"
  | "hand_gesture"
  | "gaze"
  | "prop"
  | "action"
  | "nature"
  | "selfie";

export interface PosePreset {
  id: string;
  vi: string;
  en: string;
  category: PoseCategory;
  framing: "close_up" | "medium" | "medium_full" | "full" | "wide";
  emoji?: string;
}

export const POSE_CATEGORIES: { id: PoseCategory; label: string; emoji: string }[] = [
  { id: "walking", label: "Đi & Bước", emoji: "🚶" },
  { id: "standing", label: "Đứng dáng", emoji: "🧍" },
  { id: "sitting", label: "Ngồi", emoji: "🪑" },
  { id: "lying", label: "Nằm", emoji: "🛏" },
  { id: "hand_gesture", label: "Tay & cử chỉ", emoji: "🤲" },
  { id: "gaze", label: "Nhìn xa & biểu cảm", emoji: "👀" },
  { id: "prop", label: "Tương tác đồ vật", emoji: "🎒" },
  { id: "action", label: "Action & vận động", emoji: "🏃" },
  { id: "nature", label: "Tương tác thiên nhiên", emoji: "🌸" },
  { id: "selfie", label: "Selfie & gương", emoji: "📱" },
];

export const POSES: PosePreset[] = [
  // ============================================================================
  // 🚶 WALKING (10)
  // ============================================================================
  { id: "walking_forward", vi: "Đi thẳng về phía trước", en: "Walking forward toward the camera with natural mid-stride steps, arms swinging gently, soft smile, hair lightly bouncing", category: "walking", framing: "full" },
  { id: "walking_back_look", vi: "Đi tới rồi quay lại nhìn", en: "Walking forward away from camera, then turning head back over the shoulder with a soft smile, hair caught mid-motion in the breeze", category: "walking", framing: "full" },
  { id: "walking_away", vi: "Đi xa máy ảnh (chụp lưng)", en: "Walking away from the camera, shot from behind, one hand reaching up to touch the back of the head or hair, dress hem swaying", category: "walking", framing: "full" },
  { id: "walking_dress_swirl", vi: "Đi xoay nhẹ tà váy bay", en: "Walking and gently spinning so the dress hem swirls outward, one hand lifted to shoulder height for balance, joyful expression", category: "walking", framing: "full" },
  { id: "walking_leaves", vi: "Đi chậm trên thảm lá vàng", en: "Strolling slowly on a carpet of fallen yellow autumn leaves, eyes downcast watching footsteps, both hands tucked into coat pockets", category: "walking", framing: "full" },
  { id: "walking_field", vi: "Đi xuyên cánh đồng hoa", en: "Walking through a field of wild flowers, hands gently brushing the tops of the blooms on either side, dreamy gaze ahead, hair gently lifted by wind", category: "walking", framing: "full" },
  { id: "walking_holding_hat", vi: "Đi giữ mũ tránh gió", en: "Walking forward with one hand pressing the brim of a sun hat against the wind, the other hand swinging naturally, slight smile", category: "walking", framing: "full" },
  { id: "walking_with_basket", vi: "Đi mang giỏ hoa", en: "Walking with a wicker basket of flowers or fruit hooked over one arm, the other hand swaying naturally, gentle smile, idyllic countryside vibe", category: "walking", framing: "full" },
  { id: "walking_uphill", vi: "Đi lên dốc, tay vịn lan can", en: "Climbing a stone staircase or hill path, one hand lightly resting on the railing for support, head turned slightly toward the camera", category: "walking", framing: "full" },
  { id: "walking_alley", vi: "Đi trong hẻm phố cổ tay chống tường", en: "Walking through an old town alleyway, one fingertip lightly trailing along the yellow weathered wall, looking forward with a quiet smile", category: "walking", framing: "full" },

  // ============================================================================
  // 🧍 STANDING (12)
  // ============================================================================
  { id: "standing_hand_in_pocket", vi: "Đứng tay đút túi chân chữ thập", en: "Standing with weight shifted to one leg, the other crossed in front, one hand tucked in the pocket, the other relaxed at the side, casual confidence", category: "standing", framing: "full" },
  { id: "standing_contrapposto", vi: "Đứng contrapposto hông lệch", en: "Classic contrapposto stance: weight on one leg, hip pushed slightly outward to create an S-curve, shoulders relaxed, gaze toward camera", category: "standing", framing: "full" },
  { id: "standing_arms_crossed", vi: "Khoanh tay tự tin", en: "Standing facing camera with arms loosely crossed at the chest, soft confident smile, head tilted slightly to one side", category: "standing", framing: "medium_full" },
  { id: "standing_one_hand_hip", vi: "Một tay chống hông", en: "Standing with one hand resting on the hip, elbow gently angled out, the other arm loose at the side, head tilted, light smile", category: "standing", framing: "medium_full" },
  { id: "standing_lean_wall", vi: "Tựa lưng vào tường", en: "Leaning back against a wall with shoulders relaxed, one foot flat against the wall, hands resting at sides or in pockets, casual gaze to camera", category: "standing", framing: "full" },
  { id: "standing_lean_railing", vi: "Tựa hông vào lan can ngắm cảnh", en: "Leaning hip against a railing or balcony edge with one elbow resting on the bar, body angled slightly toward the view, hair softly lifting in breeze", category: "standing", framing: "medium_full" },
  { id: "standing_arms_up", vi: "Hai tay giơ lên trời thư giãn", en: "Standing with both arms raised high to the sky, palms open, eyes closed with a content smile, embracing the surroundings", category: "standing", framing: "full" },
  { id: "standing_back_to_camera", vi: "Quay lưng hai tay chống hông", en: "Standing with back to camera, hands resting on hips, looking out at the scenery, hair flowing down the back", category: "standing", framing: "full" },
  { id: "standing_back_arm_raised", vi: "Quay lưng tay chỉ về xa", en: "Standing with back to camera, one arm raised pointing toward the distant horizon, the other hand resting on hip, head slightly tilted", category: "standing", framing: "full" },
  { id: "standing_arms_t_shape", vi: "Hai tay dang ngang chữ T", en: "Standing with both arms extended outward to the sides like a T, palms down, head tilted up to the sky, free and unrestrained mood", category: "standing", framing: "full" },
  { id: "standing_one_leg_bent", vi: "Một chân trụ, chân kia gập gối", en: "Standing on one leg with the other knee bent up, foot resting against the supporting leg, balanced and playful, arms loose at sides", category: "standing", framing: "full" },
  { id: "standing_holding_hat", vi: "Đứng giữ mũ trên đầu", en: "Standing with both hands holding the brim of a wide sun hat on top of the head, elbows out forming a frame around the face, looking up with a smile", category: "standing", framing: "medium" },

  // ============================================================================
  // 🪑 SITTING (10)
  // ============================================================================
  { id: "sitting_steps", vi: "Ngồi bậc thềm chống cằm", en: "Sitting on stone steps, knees together, both hands cupping the chin or one elbow propped on knee with chin in palm, dreamy expression", category: "sitting", framing: "full" },
  { id: "sitting_floor_cross", vi: "Ngồi xếp bằng trên sàn", en: "Sitting cross-legged on the ground or floor in bohemian style, hands resting in lap, body slightly forward, soft smile", category: "sitting", framing: "full" },
  { id: "sitting_legs_crossed", vi: "Ngồi gác chân sang một bên", en: "Sitting elegantly with knees together and legs angled to one side (mermaid pose), one hand supporting the body, the other on the lap or knee", category: "sitting", framing: "full" },
  { id: "sitting_bench", vi: "Ngồi ghế đá nhìn xa", en: "Sitting on a stone or wooden park bench, body angled slightly, one arm draped along the back of the bench, gaze drifting toward the view", category: "sitting", framing: "full" },
  { id: "sitting_cafe_table", vi: "Ngồi bàn cà phê tay cầm ly", en: "Sitting at a small café table, both hands wrapped around a coffee cup, slight forward lean, gentle smile, café ambience", category: "sitting", framing: "medium_full" },
  { id: "sitting_one_hand_back", vi: "Ngồi chống tay ra sau, người nghiêng", en: "Sitting with one hand planted behind on the surface for support, body angled toward that hand, the other hand resting on a knee, casual relaxed pose", category: "sitting", framing: "full" },
  { id: "sitting_knees_chest", vi: "Ngồi ôm gối nhìn xa", en: "Sitting with knees pulled up to the chest, both arms wrapped around the legs, chin resting on knees, gaze fixed on the distance, contemplative", category: "sitting", framing: "full" },
  { id: "sitting_high_perch", vi: "Ngồi mép cao thõng chân", en: "Sitting on a high ledge, low wall, or balcony edge with legs dangling freely, hands gripping the edge for support, looking out and down", category: "sitting", framing: "full" },
  { id: "sitting_grass", vi: "Ngồi trên cỏ vuốt cỏ", en: "Sitting on green grass with legs tucked to one side, one hand running gently through the grass blades, soft serene smile", category: "sitting", framing: "full" },
  { id: "sitting_stairs_lean", vi: "Ngồi cầu thang đá tựa tường", en: "Sitting on a stone staircase, back leaning against the wall, knees bent, one arm draped over the knee, the other hand resting on a step", category: "sitting", framing: "full" },

  // ============================================================================
  // 🛏 LYING (8)
  // ============================================================================
  { id: "lying_back_grass", vi: "Nằm ngửa trên cỏ", en: "Lying flat on her back on green grass, both hands tucked behind the head, eyes closed with a peaceful smile, hair fanned out around the head", category: "lying", framing: "full" },
  { id: "lying_back_arm_over", vi: "Nằm ngửa tay che trán", en: "Lying on the back with one arm draped across the forehead as if shielding from the sun, the other arm relaxed at the side, dreamy expression", category: "lying", framing: "full" },
  { id: "lying_side_propped", vi: "Nằm nghiêng chống cùi chỏ", en: "Lying on one side with the body propped up by the elbow, hand supporting the head, the other arm resting along the body, soft smile", category: "lying", framing: "full" },
  { id: "lying_face_down_sand", vi: "Nằm sấp ôm cằm", en: "Lying face down on sand or grass, elbows propped up, both hands cupping the chin, legs bent up at knees ankles crossed, dreamy smile", category: "lying", framing: "full" },
  { id: "lying_legs_air", vi: "Nằm sấp hai chân giơ đung đưa", en: "Lying face down with elbows propped up, both legs bent at the knees and lifted into the air, ankles swaying playfully, cheeky smile", category: "lying", framing: "full" },
  { id: "lying_reading", vi: "Nằm sấp đọc sách", en: "Lying face down on a blanket with an open book in front, both elbows propped, chin resting on knuckles, eyes on the page, peaceful concentration", category: "lying", framing: "full" },
  { id: "lying_flowers_around", vi: "Nằm giữa thảm hoa", en: "Lying on the back surrounded by a bed of wild flowers, one hand gently touching a bloom near the face, eyes half-closed with a content smile", category: "lying", framing: "full" },
  { id: "lying_blanket_picnic", vi: "Nằm trên chăn picnic cầm trái cây", en: "Reclining on a picnic blanket on one elbow, holding a piece of fruit or a flower up toward the lips, the other leg gracefully bent, summer afternoon vibe", category: "lying", framing: "full" },

  // ============================================================================
  // 🤲 HAND GESTURES (15)
  // ============================================================================
  { id: "hand_through_hair", vi: "Tay luồn qua mái tóc", en: "One hand raised to gently run fingers through the hair as if smoothing it back, elbow up, head tilted slightly, soft natural smile", category: "hand_gesture", framing: "medium" },
  { id: "hand_touching_hair_tip", vi: "Tay chạm đuôi tóc", en: "Hand reaching down to lightly touch or twirl the tip of the hair near the shoulder, gaze drifting away, gentle reflective expression", category: "hand_gesture", framing: "medium" },
  { id: "hand_flip_hair", vi: "Hất tóc ra sau với gió", en: "Mid-motion hair flip backward, hair caught in the air mid-arc, one hand following through the motion, eyes squinting with a laugh", category: "hand_gesture", framing: "medium" },
  { id: "hand_cover_half_face", vi: "Tay che nửa mặt", en: "One hand raised gently covering one half of the face, only one eye visible peeking through fingers, mysterious soft expression", category: "hand_gesture", framing: "close_up" },
  { id: "hand_chin_rest", vi: "Chống cằm suy tư", en: "One elbow propped on a surface or knee with the chin resting in the palm, fingers curled along the cheek, contemplative gaze", category: "hand_gesture", framing: "close_up" },
  { id: "hand_frame_face", vi: "Hai tay tạo khung quanh mặt", en: "Both hands raised to frame the sides of the face like a picture frame, fingers spread softly, playful smile", category: "hand_gesture", framing: "close_up" },
  { id: "hand_blow_kiss", vi: "Gửi nụ hôn gió", en: "One hand raised to the lips and extended outward as if blowing a kiss to the camera, eyes warm and playful", category: "hand_gesture", framing: "medium" },
  { id: "hand_peace_sign", vi: "V-tay (peace sign) cười tươi", en: "Holding up a V-sign (peace sign) near the cheek with one hand, bright open smile, head tilted in a cute K-pop inspired pose", category: "hand_gesture", framing: "medium" },
  { id: "hand_heart_chest", vi: "Hai tay tạo trái tim", en: "Both hands joined together to form a heart shape over the chest, eyes warm, sincere soft smile", category: "hand_gesture", framing: "medium" },
  { id: "hand_pulling_collar", vi: "Tay kéo cổ áo", en: "One hand reaching up to gently pull or adjust the collar of the shirt or coat, head tilted, soft confident expression", category: "hand_gesture", framing: "medium" },
  { id: "hand_adjust_earring", vi: "Tay chỉnh hoa tai", en: "One hand raised gracefully to touch or adjust an earring, head tilted to expose the ear, the other hand resting at the side, elegant", category: "hand_gesture", framing: "close_up" },
  { id: "hand_holding_hair_back", vi: "Hai tay giữ tóc ra sau", en: "Both hands raised to hold the hair gathered behind the head as if tying it up, elbows out, neckline exposed, soft smile", category: "hand_gesture", framing: "medium" },
  { id: "hand_pointing_far", vi: "Tay chỉ về xa", en: "One arm extended pointing toward something in the distance, body and gaze following the direction, the other hand resting at the side", category: "hand_gesture", framing: "full" },
  { id: "hand_wave", vi: "Vẫy tay chào camera", en: "One hand raised waving toward the camera, fingers spread, bright cheerful greeting smile", category: "hand_gesture", framing: "medium" },
  { id: "hand_open_palm_sky", vi: "Ngửa lòng bàn tay đón nắng", en: "One arm extended outward with the palm open and turned upward to catch sunlight, gaze lifted toward the sky, peaceful expression", category: "hand_gesture", framing: "medium_full" },

  // ============================================================================
  // 👀 GAZE & EXPRESSION (10)
  // ============================================================================
  { id: "gaze_distant_horizon", vi: "Nhìn về xa chân trời", en: "Profile or three-quarter turn, gaze fixed thoughtfully on the distant horizon, lips parted slightly, hair gently moving with breeze, contemplative mood", category: "gaze", framing: "medium" },
  { id: "gaze_dreamy_smile", vi: "Cười mỉm mắt mơ màng nhìn xa", en: "Soft dreamy smile with the gaze drifting somewhere off-camera into the distance, eyes half-closed, romantic mood", category: "gaze", framing: "close_up" },
  { id: "gaze_looking_up", vi: "Ngước nhìn lên trời", en: "Head tilted back gently looking up toward the sky or tree canopy, lips parted, soft awe in the eyes, neckline exposed", category: "gaze", framing: "close_up" },
  { id: "gaze_looking_down", vi: "Cúi mặt tóc che một bên", en: "Head tilted gently downward, eyes lowered, hair falling forward to partially veil one side of the face, shy contemplative mood", category: "gaze", framing: "close_up" },
  { id: "gaze_over_shoulder", vi: "Quay đầu nhìn qua vai", en: "Body angled away with the head turned back over the shoulder toward the camera, soft knowing smile, gaze direct and intimate", category: "gaze", framing: "medium" },
  { id: "gaze_giggle", vi: "Cười khúc khích nheo mắt", en: "Caught mid-giggle, eyes squeezed nearly shut with crinkles, mouth open in a real laugh, hand maybe lifting toward the mouth", category: "gaze", framing: "close_up" },
  { id: "gaze_open_mouth_smile", vi: "Cười tươi để lộ răng", en: "Wide bright open smile showing teeth, eyes warm and crinkled with joy, head tilted slightly, a genuine candid happy expression", category: "gaze", framing: "close_up" },
  { id: "gaze_pout_lips", vi: "Bĩu môi đáng yêu", en: "Lips lightly pursed in a cute pout, eyes wide and innocent, head tilted to one side, playful K-pop inspired vibe", category: "gaze", framing: "close_up" },
  { id: "gaze_eyes_closed_smile", vi: "Nhắm mắt cười rạng rỡ", en: "Eyes gently closed with a wide content smile, head tilted up slightly toward the sky or sun, embracing the moment, peaceful joy", category: "gaze", framing: "close_up" },
  { id: "gaze_surprised", vi: "Mắt mở to ngạc nhiên", en: "Wide-open eyes with eyebrows lifted in delighted surprise, mouth in a small round O, hands optionally near the cheeks, charming reaction", category: "gaze", framing: "close_up" },

  // ============================================================================
  // 🎒 PROP INTERACTION (10)
  // ============================================================================
  { id: "prop_hold_bouquet", vi: "Cầm bó hoa trước ngực", en: "Holding a bouquet of fresh flowers (roses, daisies, or wildflowers) close to the chest with both hands, face softly leaning toward the blooms, content smile", category: "prop", framing: "medium" },
  { id: "prop_smell_flower", vi: "Ngửi hoa nhắm mắt", en: "Holding a single flower or small bouquet up to the nose with both hands, eyes closed gently, soft smile, head tilted slightly to the side", category: "prop", framing: "close_up" },
  { id: "prop_hold_coffee", vi: "Cầm cốc cà phê hai tay", en: "Holding a coffee cup with both hands wrapped around it, steam softly rising, face leaning slightly toward the warmth, peaceful smile", category: "prop", framing: "close_up" },
  { id: "prop_sip_drink", vi: "Uống nước/cà phê", en: "Lifting a cup or glass to the lips, eyes closed or looking down into the drink, mid-sip, both hands optionally cradling the cup", category: "prop", framing: "close_up" },
  { id: "prop_hold_book", vi: "Cầm sách úp vào ngực", en: "Holding an open book pressed gently to the chest as if just finished reading, eyes drifting upward, dreamy bookworm vibe", category: "prop", framing: "medium" },
  { id: "prop_adjust_sunglasses", vi: "Đẩy kính râm lên đỉnh đầu", en: "Both hands raised pushing sunglasses up onto the top of the head from the eyes, bright cheerful smile, dynamic gesture", category: "prop", framing: "medium" },
  { id: "prop_holding_hat_brim", vi: "Tay giữ vành mũ ngược gió", en: "One or both hands holding the brim of a wide-brimmed sun hat against a gust of wind, hair tossed, laughing reaction", category: "prop", framing: "medium" },
  { id: "prop_holding_balloon", vi: "Cầm chùm bóng bay", en: "Holding a bunch of colorful balloons by the strings in one hand raised slightly above the head, the other hand free, joyful smile, festive vibe", category: "prop", framing: "full" },
  { id: "prop_holding_camera", vi: "Cầm máy ảnh trước mặt", en: "Holding a vintage film camera or DSLR up in front of the face as if about to take a photo, one eye visible above the camera, playful pose", category: "prop", framing: "close_up" },
  { id: "prop_holding_phone_selfie", vi: "Giơ điện thoại tự sướng", en: "One hand raised holding a phone for a selfie, screen facing herself, the other hand near the face for a peace sign or soft pose", category: "prop", framing: "medium" },

  // ============================================================================
  // 🏃 ACTION (10)
  // ============================================================================
  { id: "action_running_beach", vi: "Chạy trên cát biển", en: "Mid-run along the wet sand at the water's edge, hair and dress flowing backward in motion, arms swinging, laughing freely", category: "action", framing: "full" },
  { id: "action_jumping_arms_up", vi: "Nhảy lên cao hai tay giơ", en: "Captured mid-jump with both arms raised high above the head, knees bent, hair lifted, big open joyful smile, freedom expression", category: "action", framing: "full" },
  { id: "action_twirling", vi: "Xoay người váy bay tròn", en: "Mid-twirl with arms outstretched, dress flaring outward in a circle, hair fanning out, joyful laughing expression", category: "action", framing: "full" },
  { id: "action_skipping", vi: "Nhảy chân sáo", en: "Skipping forward with a bouncing stride, one knee lifted high, opposite arm swinging up, lively cheerful smile", category: "action", framing: "full" },
  { id: "action_dancing_free", vi: "Nhảy tự do mắt nhắm", en: "Dancing freely with both arms raised in flowing motion, eyes gently closed, lost in the moment, expressive joyful pose", category: "action", framing: "full" },
  { id: "action_chasing_birds", vi: "Chạy đuổi đàn chim/bồ câu", en: "Running through a flock of pigeons or seagulls scattering upward into the air, arms slightly out, laughing in delight, candid action", category: "action", framing: "full" },
  { id: "action_kicking_water", vi: "Đá nước biển/sông", en: "Mid-kick splashing water at the shoreline or shallow stream, water droplets frozen in the air, laughing, hem of the dress lifted", category: "action", framing: "full" },
  { id: "action_balancing_curb", vi: "Đi thăng bằng trên mép vỉa hè", en: "Walking carefully along the edge of a curb or low wall with arms stretched out to the sides for balance, focused playful expression", category: "action", framing: "full" },
  { id: "action_throwing_leaves", vi: "Tung lá vàng lên không trung", en: "Mid-motion tossing a handful of yellow autumn leaves into the air, leaves scattered around the body, head tilted up watching them fall, laughing", category: "action", framing: "full" },
  { id: "action_pretending_fly", vi: "Hai tay dang ngang giả vờ bay", en: "Standing on tiptoes with both arms extended wide like wings, head tilted up, eyes closed feeling the wind, freedom and weightlessness", category: "action", framing: "full" },

  // ============================================================================
  // 🌸 NATURE INTERACTION (10)
  // ============================================================================
  { id: "nature_touch_flower", vi: "Chạm hoa cao", en: "Standing on tip-toes, one hand reaching up to gently touch a high blossom or branch above the head, eyes following the fingertips, peaceful expression", category: "nature", framing: "medium_full" },
  { id: "nature_pluck_grass", vi: "Cúi xuống ngắt cỏ/hoa dại", en: "Bent forward gracefully, one hand reaching down to pluck a wild flower or blade of grass, the other hand holding back the hair, gentle natural mood", category: "nature", framing: "full" },
  { id: "nature_arm_through_field", vi: "Đi xuyên cánh đồng tay lướt qua bông cỏ", en: "Walking slowly through tall grass or a wildflower field with one arm extended outward at hip height, fingertips brushing the tops of the plants", category: "nature", framing: "medium_full" },
  { id: "nature_hugging_tree", vi: "Ôm thân cây", en: "Hugging a large tree trunk with both arms wrapped around it, cheek pressed against the bark, eyes closed with a content smile, connected to nature", category: "nature", framing: "medium_full" },
  { id: "nature_sitting_on_branch", vi: "Ngồi trên cành cây thấp", en: "Sitting balanced on a low sturdy tree branch, legs dangling, hands resting on the branch beside her, looking out through the leaves, dreamy", category: "nature", framing: "full" },
  { id: "nature_feeding_bird", vi: "Đưa tay cho chim đậu", en: "One arm extended outward with the palm open and flat as if offering food, a small bird or pigeon perched or flying near the hand, gentle gaze on the bird", category: "nature", framing: "medium_full" },
  { id: "nature_playing_water", vi: "Ngồi mép sông tay chạm nước", en: "Sitting at the edge of a river or lake, leaning forward with one hand dipped into the water creating ripples, the other supporting her body", category: "nature", framing: "full" },
  { id: "nature_collecting_seashells", vi: "Cúi nhặt vỏ sò", en: "Crouched on the beach examining a seashell held in one hand, the other hand resting on the sand for balance, hair falling forward, focused soft smile", category: "nature", framing: "full" },
  { id: "nature_under_waterfall", vi: "Đứng dưới thác nước", en: "Standing facing a small waterfall or stream, eyes closed with face turned upward, hands raised to feel the mist, blissful expression", category: "nature", framing: "medium_full" },
  { id: "nature_on_rock", vi: "Ngồi trên tảng đá nhìn ra biển", en: "Sitting cross-legged or with knees tucked on a large flat rock overlooking the ocean or valley, hair lifted by the wind, contemplative gaze outward", category: "nature", framing: "full" },

  // ============================================================================
  // 📱 SELFIE & MIRROR (5)
  // ============================================================================
  { id: "selfie_arm_out", vi: "Tự sướng cười tươi", en: "Holding a phone out at arm's length for a selfie, bright open smile directly into the camera, head tilted slightly, hair falling naturally", category: "selfie", framing: "close_up" },
  { id: "selfie_with_landmark", vi: "Selfie với landmark phía sau", en: "Holding a phone for a selfie with a famous landmark or scenic view visible in the background, peace sign with the free hand, cheerful tourist vibe", category: "selfie", framing: "medium" },
  { id: "mirror_pose", vi: "Đứng trước gương phone giơ cao", en: "Standing in front of a full-length mirror, one hand holding a phone up to capture the reflection, the other hand on the hip or by the face, OOTD pose", category: "selfie", framing: "full" },
  { id: "mirror_back_view", vi: "Gương quay lưng nhìn phản chiếu", en: "Standing with back to the camera but face visible in a mirror reflection, holding a phone discreetly, looking at her own reflection, artistic mood", category: "selfie", framing: "full" },
  { id: "selfie_jump_high", vi: "Tự sướng nhảy cao", en: "Mid-jump with phone held high in one hand for a selfie, free hand thrown up in joy, hair and clothes mid-motion, exuberant expression", category: "selfie", framing: "full" },
];

// ============================================================================
// Helpers
// ============================================================================

export function getPoseById(id: string): PosePreset | undefined {
  return POSES.find((p) => p.id === id);
}

export function getPosesByCategory(category: PoseCategory): PosePreset[] {
  return POSES.filter((p) => p.category === category);
}

/**
 * Auto-vary pick — distribute N shots across categories so the resulting set
 * has variety. For N=6, picks 1 from each of 6 different categories.
 * For N>10, allows category repeats but never the same pose twice.
 */
export function autoVaryPickPoses(count: number, seed?: number): PosePreset[] {
  const cats = POSE_CATEGORIES.map((c) => c.id);
  const result: PosePreset[] = [];
  const used = new Set<string>();
  const rng = seed != null ? seededRandom(seed) : Math.random;

  // First pass: 1 from each category
  for (const cat of cats) {
    if (result.length >= count) break;
    const candidates = POSES.filter((p) => p.category === cat && !used.has(p.id));
    if (candidates.length === 0) continue;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    result.push(pick);
    used.add(pick.id);
  }

  // Second pass: fill remaining from any category
  while (result.length < count) {
    const candidates = POSES.filter((p) => !used.has(p.id));
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    result.push(pick);
    used.add(pick.id);
  }

  return result;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
