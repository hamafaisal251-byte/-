package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"strings"
)

var masterKey []byte

// InitKey hashes the master recovery key using SHA-256 to ensure it is exactly 32 bytes (256 bits) for AES-256.
func InitKey(rawKey string) {
	h := sha256.New()
	h.Write([]byte(rawKey))
	masterKey = h.Sum(nil)
}

// PKCS7Padding pads a byte slice to a multiple of blockSize (standard padding scheme used in Node's crypto).
func PKCS7Padding(src []byte, blockSize int) []byte {
	padding := blockSize - len(src)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(src, padtext...)
}

// PKCS7Unpadding removes the PKCS#7 padding of a decrypted byte slice and validates it.
func PKCS7Unpadding(src []byte) ([]byte, error) {
	length := len(src)
	if length == 0 {
		return nil, errors.New("empty decrypted ciphertext")
	}
	unpadding := int(src[length-1])
	if unpadding > length {
		return nil, errors.New("invalid padding length size")
	}
	for i := length - unpadding; i < length; i++ {
		if int(src[i]) != unpadding {
			return nil, errors.New("invalid padding bytes")
		}
	}
	return src[:(length - unpadding)], nil
}

// Encrypt encrypts a plaintext string using AES-256-CBC and returns hex(iv):hex(ciphertext)
func Encrypt(text string) (string, error) {
	if text == "" {
		return "", nil
	}
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", err
	}

	iv := make([]byte, aes.BlockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	plaintext := PKCS7Padding([]byte(text), aes.BlockSize)
	mode := cipher.NewCBCEncrypter(block, iv)
	ciphertext := make([]byte, len(plaintext))
	mode.CryptBlocks(ciphertext, plaintext)

	return hex.EncodeToString(iv) + ":" + hex.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a hex(iv):hex(ciphertext) string using AES-256-CBC and returns plaintext
func Decrypt(encryptedText string) (string, error) {
	if encryptedText == "" {
		return "", nil
	}
	parts := strings.Split(encryptedText, ":")
	if len(parts) != 2 {
		return "", errors.New("invalid encrypted text format - missing colon separator")
	}

	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	ciphertext, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", err
	}

	if len(ciphertext)%aes.BlockSize != 0 {
		return "", errors.New("ciphertext block size is not a multiple of AES block size")
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	decrypted := make([]byte, len(ciphertext))
	mode.CryptBlocks(decrypted, ciphertext)

	unpadded, err := PKCS7Unpadding(decrypted)
	if err != nil {
		return "", err
	}

	return string(unpadded), nil
}
