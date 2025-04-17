// src/user/user.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto'; // 수정된 DTO 임포트
import * as bcrypt from 'bcrypt';
import { Role } from '../auth/enums/role.enum'; // Role enum 임포트

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    console.log('Create user:', createUserDto);
    // 이제 role? 속성을 정상적으로 받아올 수 있음
    const { username, email, password, role } = createUserDto;

    // 이메일 중복 확인
    const existingUserByEmail = await this.userRepository.findOne({ where: { email } });
    if (existingUserByEmail) {
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }
    // 사용자 이름 중복 확인 (필요 시)
    const existingUserByUsername = await this.userRepository.findOne({ where: { username } });
     if (existingUserByUsername) {
       throw new ConflictException('이미 사용 중인 사용자 이름입니다.');
     }

    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 사용자 생성 (username 추가, role 기본값 처리)
    const user = this.userRepository.create({
      username, // username 추가
      email,
      password_hash: hashedPassword,
      role: role || Role.USER, // DTO에 role이 없으면 기본값 USER 사용
    });

    const savedUser = await this.userRepository.save(user);
    console.log('User saved:', { id: savedUser.id, email: savedUser.email });
    return savedUser;
  }

  async findOneByEmail(email: string): Promise<User | undefined> {
    console.log('Find user by email:', email);
    // User 엔티티에 role이 포함되어 반환됨
    const user = await this.userRepository.findOne({ where: { email } });
    console.log('User found:', user ? { id: user.id, email: user.email } : null);
    return user;
  }

  async findOneById(id: string): Promise<User | undefined> {
    console.log('Find user by id:', id);
    // User 엔티티에 role이 포함되어 반환됨
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
        throw new NotFoundException(`ID가 ${id}인 사용자를 찾을 수 없습니다.`);
    }
    console.log('User found:', user ? { id: user.id, email: user.email } : null);
    return user;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    console.log('Update user:', { id, updateData });
    // 사용자가 존재하는지 먼저 확인
    const userToUpdate = await this.findOneById(id); // findOneById가 NotFoundException 처리
    await this.userRepository.update(id, updateData);
    // 업데이트된 사용자 정보를 반환 (findOneById는 캐시 등 문제 가능성 있음, merge/preload 고려)
    // 가장 확실한 방법은 업데이트된 데이터를 직접 반환하거나 다시 조회하는 것
    const updatedUser = await this.userRepository.findOne({ where: { id } });
    if (!updatedUser) {
       // 이론적으로 update 후 즉시 findOneById를 호출하면 찾을 수 있어야 함
       throw new NotFoundException(`ID가 ${id}인 사용자를 업데이트 후 찾을 수 없습니다.`);
    }
    console.log('User updated:', { id: updatedUser?.id, email: updatedUser?.email });
    return updatedUser;
  }
}