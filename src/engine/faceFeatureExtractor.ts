/**
 * Face Feature Extractor v0.6.6
 *
 * Uses Gemini Vision (multimodal) to analyze face reference image
 * and extract specific identifying features automatically.
 *
 * Returns Vietnamese descriptions for user to review and edit.
 */

import { callGeminiVision } from "./gemini";

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích đặc điểm gương mặt cho mục đích giúp AI image generation tạo lại đúng người trong ảnh tham chiếu.

Nhiệm vụ: Quan sát tấm ảnh khuôn mặt được cung cấp, liệt kê CÁC ĐẶC ĐIỂM ĐỘC ĐÁO giúp phân biệt người này với người khác.

QUY TẮC:
1. CHỈ liệt kê các đặc điểm THỰC SỰ NHÌN THẤY trong ảnh — không phỏng đoán
2. Tập trung vào các đặc điểm có thể giúp AI image generator tạo lại đúng người này:
   - Nốt ruồi, tàn nhang (vị trí cụ thể)
   - Lúm đồng tiền (hai bên / một bên)
   - Sẹo nhỏ (nếu có)
   - Hình dạng lông mày đặc trưng (cong, thẳng, dày, mỏng, có vết, có nét đặc biệt)
   - Hình dạng mắt đặc trưng (mí đôi/đơn, đuôi mắt nhếch lên/xuống, khoảng cách 2 mắt)
   - Hình dạng mũi (sống mũi cao/thấp/thẳng/hơi gồ, cánh mũi)
   - Hình dạng môi (đầy/mỏng, môi trên/dưới)
   - Cấu trúc xương gò má, cằm, hàm
   - Đặc trưng khác (ví dụ: khuôn mặt trái xoan, vuông, chữ V)
3. KHÔNG mô tả: makeup, hairstyle, accessories, lighting, expression — những thứ thay đổi
4. Mô tả ngắn gọn, chính xác, dùng từ kỹ thuật

ĐỊNH DẠNG OUTPUT:
Chỉ output 1 dòng plain text, các đặc điểm cách nhau bằng dấu phẩy. Không bullet, không heading, không markdown.

VÍ DỤ:
"nốt ruồi nhỏ ở má trái dưới mắt, lúm đồng tiền 2 bên khi cười, lông mày dày cong tự nhiên, mắt mí đôi đuôi mắt hơi nhếch lên, sống mũi thẳng cao, môi trên đầy hơn môi dưới, khuôn mặt trái xoan với cằm V"

Nếu không nhìn thấy đặc điểm rõ ràng nào, output: "không có đặc điểm nổi bật rõ ràng — recommend Jason chụp ảnh rõ hơn"`;

/**
 * Convert Blob to base64 string (without data URL prefix).
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip "data:image/...;base64," prefix
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract identifying features from a face image using Gemini Vision.
 */
export async function extractFaceFeatures(imageBlob: Blob): Promise<string> {
  const base64 = await blobToBase64(imageBlob);
  const mimeType = imageBlob.type || "image/jpeg";

  const userPrompt = "Phân tích ảnh khuôn mặt này và liệt kê các đặc điểm độc đáo giúp AI image generation tái tạo lại đúng người này.";

  const result = await callGeminiVision(
    SYSTEM_PROMPT,
    userPrompt,
    base64,
    mimeType,
    0.4,  // Lower temp for more consistent extraction
    512   // Short response (1 line)
  );

  // Clean up response — strip markdown, quotes, "Output:" prefixes etc.
  let cleaned = result.trim();
  // Remove common AI preambles
  cleaned = cleaned.replace(/^(Đáp án|Output|Kết quả|Answer)[:：]\s*/i, "");
  cleaned = cleaned.replace(/^["']/, "").replace(/["']$/, "");
  // Remove markdown
  cleaned = cleaned.replace(/^\*+\s*/, "").replace(/\*+$/, "");
  cleaned = cleaned.replace(/^#+\s*/, "");
  cleaned = cleaned.trim();

  return cleaned;
}
